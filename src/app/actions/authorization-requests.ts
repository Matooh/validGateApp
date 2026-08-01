'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireUser } from '@/lib/auth';
import {
  type AuthorizationMessageCode,
  getAuthorizationMessage,
} from '@/lib/messages/authorization-messages';
import { getCurrentStudentForAuthenticatedUser } from '@/lib/students/get-current-student';
import { createClient } from '@/lib/supabase/server';

type ActionResult = {
  success: boolean;
  messageCode: AuthorizationMessageCode;
  requestId?: string;
};

type PendingAuthorizationRequestRow = {
  id: string;
  student_id: number;
  request_type: string;
  reason: string | null;
  requested_at: string;
  expires_at: string;
  students:
    | {
        first_name: string;
        last_name: string;
        is_in_institution: boolean;
        courses?: { name: string | null } | { name: string | null }[] | null;
      }
    | {
        first_name: string;
        last_name: string;
        is_in_institution: boolean;
        courses?: { name: string | null } | { name: string | null }[] | null;
      }[]
    | null;
};

export type GuardianPendingAuthorizationRequest = {
  id: string;
  studentId: number;
  studentName: string;
  courseName: string | null;
  isInInstitution: boolean;
  requestType: string;
  reason: string | null;
  requestedAt: string;
  expiresAt: string;
};

type AuthorizationResponseRpcRow = {
  request_id: string;
  message_code: AuthorizationMessageCode;
};

type SupabaseActionError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

function getStudentFromPendingRequest(row: PendingAuthorizationRequestRow) {
  return Array.isArray(row.students) ? row.students[0] : row.students;
}

function getCourseName(student: NonNullable<ReturnType<typeof getStudentFromPendingRequest>>) {
  const course = Array.isArray(student.courses) ? student.courses[0] : student.courses;
  return course?.name ?? null;
}

function redirectWithAuthorizationMessage(messageCode: AuthorizationMessageCode) {
  redirect(`/dashboard?message=${encodeURIComponent(getAuthorizationMessage(messageCode))}`);
}

function logAuthorizationPostError({
  action,
  httpStatus,
  publicCode,
  internalCode,
  userId,
  supabaseError,
}: {
  action: string;
  httpStatus: number;
  publicCode: AuthorizationMessageCode;
  internalCode: string;
  userId?: string;
  supabaseError?: SupabaseActionError | null;
}) {
  console.error('authorization_post_error', {
    action,
    httpStatus,
    publicCode,
    publicMessage: getAuthorizationMessage(publicCode),
    internalCode,
    userId,
    supabaseError: supabaseError
      ? {
          code: supabaseError.code,
          message: supabaseError.message,
          details: supabaseError.details,
          hint: supabaseError.hint,
        }
      : null,
  });
}

function mapStudentSelfExitMessage(messageCode: string): AuthorizationMessageCode {
  if (messageCode === 'ACCESS_EXIT_REGISTERED') return 'EXIT_REGISTERED';
  if (messageCode === 'STUDENT_SELF_EXIT_UNAVAILABLE') return 'STUDENT_EXIT_UNAVAILABLE';
  if (messageCode === 'QR_NOT_FOUND' || messageCode === 'QR_EXPIRED') {
    return 'STUDENT_EXIT_QR_REQUIRED';
  }
  if (messageCode === 'QR_STUDENT_NOT_INSIDE') return 'STUDENT_EXIT_NOT_INSIDE';
  if (messageCode === 'QR_EXIT_NOT_ALLOWED_ALONE') return 'STUDENT_EXIT_NOT_ALLOWED_ALONE';
  if (messageCode === 'QR_ALREADY_USED') return 'STUDENT_EXIT_ALREADY_USED';
  if (messageCode === 'STUDENT_PROFILE_NOT_LINKED') return 'STUDENT_PROFILE_NOT_LINKED';
  if (messageCode === 'AUTH_REQUEST_FORBIDDEN') return 'AUTH_REQUEST_FORBIDDEN';

  return 'AUTH_REQUEST_FAILED';
}

function getStudentSelfExitHttpStatus(messageCode: string): number {
  if (messageCode === 'QR_NOT_FOUND' || messageCode === 'QR_EXPIRED') return 428;
  if (messageCode === 'QR_STUDENT_NOT_INSIDE' || messageCode === 'QR_ALREADY_USED') return 409;
  if (
    messageCode === 'QR_EXIT_NOT_ALLOWED_ALONE' ||
    messageCode === 'STUDENT_PROFILE_NOT_LINKED' ||
    messageCode === 'AUTH_REQUEST_FORBIDDEN'
  ) {
    return 403;
  }

  return 500;
}

export async function createStudentExitAuthorizationRequest(
  reason?: string,
): Promise<ActionResult> {
  const { user, profile } = await requireUser();
  if (profile?.role !== 'ESTUDIANTE') {
    return { success: false, messageCode: 'AUTH_REQUEST_FORBIDDEN' };
  }

  const currentStudent = await getCurrentStudentForAuthenticatedUser();
  if (!currentStudent) {
    return { success: false, messageCode: 'AUTH_REQUEST_NOT_ALLOWED' };
  }

  if (!currentStudent.isInInstitution) {
    return { success: false, messageCode: 'AUTH_REQUEST_STUDENT_NOT_INSIDE' };
  }

  const supabase = await createClient();
  const { data: guardianLink } = await supabase
    .from('guardian_students')
    .select('guardian_profile_id, relation_type')
    .eq('student_id', currentStudent.studentId)
    .order('relation_type', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!guardianLink?.guardian_profile_id) {
    return { success: false, messageCode: 'AUTH_REQUEST_NO_GUARDIAN' };
  }

  const { data: existingPending } = await supabase
    .from('authorization_requests')
    .select('id')
    .eq('student_id', currentStudent.studentId)
    .eq('guardian_profile_id', guardianLink.guardian_profile_id)
    .eq('status', 'PENDING')
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (existingPending?.id) {
    return {
      success: true,
      messageCode: 'AUTH_REQUEST_PENDING',
      requestId: existingPending.id as string,
    };
  }

  const { data: request, error } = await supabase
    .from('authorization_requests')
    .insert({
      institution_id: currentStudent.institutionId,
      student_id: currentStudent.studentId,
      guardian_profile_id: guardianLink.guardian_profile_id,
      requested_by_profile_id: user.id,
      request_type: 'EXIT_ALONE',
      status: 'PENDING',
      reason: reason?.trim() || null,
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    })
    .select('id')
    .single();

  if (error || !request) {
    return { success: false, messageCode: 'AUTH_REQUEST_FAILED' };
  }

  revalidatePath('/dashboard');

  return {
    success: true,
    messageCode: 'AUTH_REQUEST_CREATED',
    requestId: request.id as string,
  };
}

export async function createStudentExitAuthorizationRequestFromForm(formData: FormData) {
  const reason = String(formData.get('reason') ?? '').trim();
  const result = await createStudentExitAuthorizationRequest(reason);
  redirectWithAuthorizationMessage(result.messageCode);
}

export async function confirmStudentSelfExitFromForm() {
  const { user, profile } = await requireUser();
  if (profile?.role !== 'ESTUDIANTE') {
    logAuthorizationPostError({
      action: 'confirm_student_self_exit',
      httpStatus: 403,
      publicCode: 'AUTH_REQUEST_FORBIDDEN',
      internalCode: 'SELF_EXIT_FORBIDDEN_ROLE',
      userId: user.id,
    });
    redirectWithAuthorizationMessage('AUTH_REQUEST_FORBIDDEN');
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('confirm_student_self_exit');
  const result = Array.isArray(data) ? data[0] : data;
  const messageCode = error
    ? error.code === 'PGRST202'
      ? 'STUDENT_SELF_EXIT_UNAVAILABLE'
      : 'STUDENT_SELF_EXIT_UNAVAILABLE'
    : String(result?.message_code ?? '');

  if (error) {
    logAuthorizationPostError({
      action: 'confirm_student_self_exit',
      httpStatus: error.code === 'PGRST202' ? 503 : 500,
      publicCode: 'STUDENT_EXIT_UNAVAILABLE',
      internalCode: error.code === 'PGRST202' ? 'SELF_EXIT_RPC_MISSING' : 'SELF_EXIT_RPC_FAILED',
      userId: user.id,
      supabaseError: error,
    });
  }

  if (!error && messageCode !== 'ACCESS_EXIT_REGISTERED') {
    const publicCode = mapStudentSelfExitMessage(messageCode);
    logAuthorizationPostError({
      action: 'confirm_student_self_exit',
      httpStatus: getStudentSelfExitHttpStatus(messageCode),
      publicCode,
      internalCode: messageCode || 'SELF_EXIT_EMPTY_RPC_RESPONSE',
      userId: user.id,
    });
  }

  revalidatePath('/dashboard');
  revalidatePath('/guard');
  revalidatePath('/authentications');

  redirectWithAuthorizationMessage(mapStudentSelfExitMessage(messageCode));
}

export async function listGuardianPendingAuthorizationRequests(): Promise<
  GuardianPendingAuthorizationRequest[]
> {
  const { user, profile } = await requireUser();
  if (profile?.role !== 'APODERADO') return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from('authorization_requests')
    .select(
      'id, student_id, request_type, reason, requested_at, expires_at, students(first_name, last_name, is_in_institution, courses(name))',
    )
    .eq('guardian_profile_id', user.id)
    .eq('status', 'PENDING')
    .gt('expires_at', new Date().toISOString())
    .order('requested_at', { ascending: false });

  return ((data ?? []) as PendingAuthorizationRequestRow[]).map((row) => {
    const student = getStudentFromPendingRequest(row);

    return {
      id: row.id,
      studentId: row.student_id,
      studentName: student
        ? `${student.first_name} ${student.last_name}`.trim()
        : 'Estudiante',
      courseName: student ? getCourseName(student) : null,
      isInInstitution: Boolean(student?.is_in_institution),
      requestType: row.request_type,
      reason: row.reason,
      requestedAt: row.requested_at,
      expiresAt: row.expires_at,
    };
  });
}

export async function respondToAuthorizationRequest(
  requestId: string,
  decision: 'APPROVED' | 'REJECTED',
  note?: string,
): Promise<ActionResult> {
  const { user, profile } = await requireUser();
  if (profile?.role !== 'APODERADO') {
    return { success: false, messageCode: 'AUTH_REQUEST_FORBIDDEN' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('respond_to_authorization_request', {
    p_request_id: requestId,
    p_decision: decision,
    p_note: note?.trim() || null,
  });
  const rpcResult = (Array.isArray(data) ? data[0] : data) as AuthorizationResponseRpcRow | null;

  if (error || !rpcResult) {
    logAuthorizationPostError({
      action: 'respond_to_authorization_request',
      httpStatus: 500,
      publicCode: 'AUTH_REQUEST_FAILED',
      internalCode: error?.code ?? 'AUTH_RESPONSE_EMPTY_RPC_RESPONSE',
      userId: user.id,
      supabaseError: error,
    });
    return { success: false, messageCode: 'AUTH_REQUEST_FAILED' };
  }

  if (
    rpcResult.message_code !== 'AUTH_REQUEST_APPROVED' &&
    rpcResult.message_code !== 'AUTH_REQUEST_REJECTED'
  ) {
    revalidatePath('/dashboard');
    return { success: false, messageCode: rpcResult.message_code };
  }

  revalidatePath('/dashboard');
  revalidatePath('/guard');
  revalidatePath('/authentications');

  return {
    success: true,
    messageCode: rpcResult.message_code,
    requestId: rpcResult.request_id,
  };
}

export async function respondToAuthorizationRequestFromForm(formData: FormData) {
  const requestId = String(formData.get('request_id') ?? '');
  const decision = String(formData.get('decision') ?? '');
  const note = String(formData.get('note') ?? '').trim();

  if (decision !== 'APPROVED' && decision !== 'REJECTED') {
    redirectWithAuthorizationMessage('AUTH_REQUEST_NOT_ALLOWED');
  }

  const normalizedDecision = decision as 'APPROVED' | 'REJECTED';
  const result = await respondToAuthorizationRequest(requestId, normalizedDecision, note);
  redirectWithAuthorizationMessage(result.messageCode);
}

export async function getValidExitAuthorizationForStudent(studentId: number) {
  const { profile } = await requireUser();
  if (!profile || !['ADMIN', 'PORTERIA'].includes(String(profile.role)) || !profile.institution_id) {
    return { success: false, messageCode: 'AUTH_REQUEST_FORBIDDEN' as const };
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from('student_exit_authorizations')
    .select('id, valid_until, authorization_request_id')
    .eq('student_id', studentId)
    .eq('institution_id', profile.institution_id)
    .is('used_at', null)
    .lte('valid_from', new Date().toISOString())
    .gt('valid_until', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) {
    return { success: false, messageCode: 'EXIT_AUTHORIZATION_NOT_FOUND' as const };
  }

  return {
    success: true,
    messageCode: 'EXIT_AUTHORIZATION_VALID' as const,
    authorizationId: data.id as string,
    validUntil: data.valid_until as string,
    requestId: data.authorization_request_id as string,
  };
}
