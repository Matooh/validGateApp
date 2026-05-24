'use server';

import { revalidatePath } from 'next/cache';

import { getValidExitAuthorizationForStudent } from '@/app/actions/authorization-requests';
import { requireUser } from '@/lib/auth';
import { getCurrentStudentForAuthenticatedUser } from '@/lib/students/get-current-student';
import { createClient } from '@/lib/supabase/server';
import type { QrAccessEventType, StudentQrValidationResult } from '@/lib/types';

const QR_PREFIX = 'validgate-auth:';
const QR_EXPIRATION_MS = 2 * 60 * 1000;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ProfileSnapshot = {
  id: string;
  role: string;
  institution_id: number | null;
};

type StudentSnapshot = {
  id: number;
  institution_id: number;
  course_id: number | null;
  first_name: string;
  last_name: string;
  can_leave_alone: boolean;
  is_in_institution: boolean;
  courses?: { name: string | null } | { name: string | null }[] | null;
};

type CredentialSnapshot = {
  id: string;
  student_id: number;
  institution_id: number | null;
  expires_at: string;
  used_at: string | null;
  revoked_at: string | null;
  students: StudentSnapshot | StudentSnapshot[] | null;
};

function invalidResult(
  messageCode: StudentQrValidationResult['messageCode'],
  credentialId: string | null = null,
): StudentQrValidationResult {
  return {
    credentialId,
    studentId: null,
    firstName: null,
    lastName: null,
    courseName: null,
    canLeaveAlone: null,
    hasValidExitAuthorization: null,
    exitAuthorizationValidUntil: null,
    isInInstitution: null,
    institutionId: null,
    validationStatus: 'INVALID',
    messageCode,
  };
}

function getStudentFromCredential(credential: CredentialSnapshot) {
  return Array.isArray(credential.students) ? credential.students[0] : credential.students;
}

function getCourseName(student: StudentSnapshot) {
  const course = Array.isArray(student.courses) ? student.courses[0] : student.courses;
  return course?.name ?? null;
}

async function getCurrentProfile(): Promise<ProfileSnapshot | null> {
  const { user, profile } = await requireUser();
  if (!profile) return null;

  return {
    id: user.id,
    role: String(profile.role),
    institution_id: profile.institution_id ?? null,
  };
}

async function canCreateCredentialForStudent(
  student: StudentSnapshot,
  profile: ProfileSnapshot,
): Promise<boolean> {
  if (
    ['ADMIN', 'PORTERIA'].includes(profile.role) &&
    profile.institution_id === student.institution_id
  ) {
    return true;
  }

  if (profile.role === 'APODERADO') {
    const supabase = await createClient();
    const { data } = await supabase
      .from('guardian_students')
      .select('id')
      .eq('guardian_profile_id', profile.id)
      .eq('student_id', student.id)
      .maybeSingle();

    return Boolean(data);
  }

  if (profile.role === 'ESTUDIANTE') {
    const currentStudent = await getCurrentStudentForAuthenticatedUser();
    return currentStudent?.studentId === student.id;
  }

  return false;
}

export async function createStudentQrCredential(studentId?: number) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return { success: false, messageCode: 'QR_FORBIDDEN' as const };
  }

  const supabase = await createClient();
  const resolvedStudentId =
    profile.role === 'ESTUDIANTE'
      ? (await getCurrentStudentForAuthenticatedUser())?.studentId
      : studentId;

  if (!resolvedStudentId) {
    return { success: false, messageCode: 'STUDENT_PROFILE_NOT_LINKED' as const };
  }

  const { data: student } = await supabase
    .from('students')
    .select('id, institution_id, course_id, first_name, last_name, can_leave_alone, is_in_institution')
    .eq('id', resolvedStudentId)
    .maybeSingle();

  if (!student) {
    return { success: false, messageCode: 'QR_NOT_FOUND' as const };
  }

  const authorized = await canCreateCredentialForStudent(student as StudentSnapshot, profile);
  if (!authorized) {
    return { success: false, messageCode: 'QR_FORBIDDEN' as const };
  }

  const expiresAt = new Date(Date.now() + QR_EXPIRATION_MS).toISOString();

  const { data: credential, error } = await supabase
    .from('student_qr_credentials')
    .insert({
      student_id: student.id,
      institution_id: student.institution_id,
      purpose: 'ACCESS_VALIDATION',
      expires_at: expiresAt,
      created_by: profile.id,
    })
    .select('id, expires_at')
    .single();

  if (error || !credential) {
    return { success: false, messageCode: 'QR_EVENT_FAILED' as const };
  }

  revalidatePath('/authentications');
  revalidatePath('/dashboard');

  return {
    success: true,
    credentialId: credential.id as string,
    qrPayload: `${QR_PREFIX}${credential.id}`,
    expiresAt: credential.expires_at as string,
    messageCode: 'QR_CREATED' as const,
  };
}

export async function parseValidGateQrPayload(payload: string) {
  const normalizedPayload = payload.trim();

  if (!normalizedPayload.startsWith(QR_PREFIX)) {
    return { success: false, messageCode: 'QR_INVALID_FORMAT' as const };
  }

  const credentialId = normalizedPayload.slice(QR_PREFIX.length);

  if (!UUID_PATTERN.test(credentialId)) {
    return { success: false, messageCode: 'QR_INVALID_FORMAT' as const };
  }

  return { success: true, credentialId };
}

export async function validateStudentQrCredential(
  payload: string,
): Promise<StudentQrValidationResult> {
  const profile = await getCurrentProfile();
  if (!profile || !['ADMIN', 'PORTERIA'].includes(profile.role) || !profile.institution_id) {
    return invalidResult('QR_FORBIDDEN');
  }

  const parsed = await parseValidGateQrPayload(payload);
  if (!parsed.success) {
    return invalidResult(parsed.messageCode ?? 'QR_INVALID_FORMAT');
  }

  const supabase = await createClient();
  const { data: credential } = await supabase
    .from('student_qr_credentials')
    .select(
      'id, student_id, institution_id, expires_at, used_at, revoked_at, students(id, institution_id, course_id, first_name, last_name, can_leave_alone, is_in_institution, courses(name))',
    )
    .eq('id', parsed.credentialId)
    .maybeSingle();

  if (!credential) {
    return invalidResult('QR_NOT_FOUND', parsed.credentialId);
  }

  const typedCredential = credential as CredentialSnapshot;

  if (typedCredential.institution_id !== profile.institution_id) {
    return invalidResult('QR_FORBIDDEN', typedCredential.id);
  }

  if (typedCredential.revoked_at) {
    return invalidResult('QR_REVOKED', typedCredential.id);
  }

  if (typedCredential.used_at) {
    return invalidResult('QR_ALREADY_USED', typedCredential.id);
  }

  if (new Date(typedCredential.expires_at).getTime() <= Date.now()) {
    return invalidResult('QR_EXPIRED', typedCredential.id);
  }

  const student = getStudentFromCredential(typedCredential);
  if (!student) {
    return invalidResult('QR_NOT_FOUND', typedCredential.id);
  }

  const exitAuthorization =
    student.is_in_institution && !student.can_leave_alone
      ? await getValidExitAuthorizationForStudent(student.id)
      : null;
  const exitAuthorizationValidUntil =
    exitAuthorization?.success && 'validUntil' in exitAuthorization && exitAuthorization.validUntil
      ? exitAuthorization.validUntil
      : null;

  return {
    credentialId: typedCredential.id,
    studentId: student.id,
    firstName: student.first_name,
    lastName: student.last_name,
    courseName: getCourseName(student),
    canLeaveAlone: student.can_leave_alone,
    hasValidExitAuthorization: Boolean(exitAuthorization?.success),
    exitAuthorizationValidUntil,
    isInInstitution: student.is_in_institution,
    institutionId: student.institution_id,
    validationStatus: 'VALID',
    messageCode: 'QR_VALID',
  };
}

export async function confirmStudentQrAccessEvent(params: {
  credentialId: string;
  eventType: QrAccessEventType;
}) {
  const profile = await getCurrentProfile();
  if (!profile || !['ADMIN', 'PORTERIA'].includes(profile.role)) {
    return { success: false, messageCode: 'QR_FORBIDDEN' as const };
  }

  if (!UUID_PATTERN.test(params.credentialId)) {
    return { success: false, messageCode: 'QR_INVALID_FORMAT' as const };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('confirm_student_qr_access_event', {
    p_credential_id: params.credentialId,
    p_event_type: params.eventType,
  });

  const result = Array.isArray(data) ? data[0] : data;
  const messageCode = result?.message_code ?? 'QR_EVENT_FAILED';

  if (error || messageCode !== 'QR_EVENT_REGISTERED') {
    return { success: false, messageCode };
  }

  revalidatePath('/guard');
  revalidatePath('/dashboard');
  revalidatePath('/authentications');

  return {
    success: true,
    messageCode: 'QR_EVENT_REGISTERED' as const,
    credentialId: result.credential_id as string,
    studentId: result.student_id as number,
  };
}

export async function confirmStudentExitFromGate(params: {
  credentialId: string;
  eventType: Extract<QrAccessEventType, 'SALIDA' | 'RETIRO'>;
}) {
  return confirmStudentQrAccessEvent(params);
}
