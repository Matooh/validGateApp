'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireStaff } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import {
  DEFAULT_ACCESS_POLICY,
  type AccessPolicy,
  type AccessPolicyFailure,
} from '@/lib/types';

const AUTHENTICATOR_METHODS = new Set(['QR', 'PIN']);

type StudentPolicySnapshot = {
  id: number;
  first_name: string;
  last_name: string;
  is_in_institution: boolean;
  can_leave_alone: boolean;
};

const CONTINGENCY_REASON_MESSAGES: Record<string, string> = {
  SIN_DISPOSITIVO: 'sin dispositivo propio',
  NO_CELULAR: 'sin celular',
  SIN_BATERIA: 'celular sin batería',
  QR_NO_DISPONIBLE: 'QR no disponible',
  CAMARA_NO_DISPONIBLE: 'cámara no disponible',
  JARDIN_INFANTIL: 'estudiante de jardín infantil',
  OTRO: 'otro motivo de contingencia',
};

function getPolicyForEvent(policy: AccessPolicy, eventType: string) {
  if (eventType === 'INGRESO') {
    return {
      requiresAuthenticator: policy.entry_requires_authenticator,
      authenticatorIsExclusive: policy.entry_authenticator_is_exclusive,
    };
  }

  return {
    requiresAuthenticator: policy.exit_requires_authenticator,
    authenticatorIsExclusive: policy.exit_authenticator_is_exclusive,
  };
}

function resolvePolicyFailure({
  eventType,
  exitKind,
  notes,
  policy,
  student,
  authenticatorPresented,
}: {
  eventType: string;
  exitKind: string;
  notes: string;
  policy: AccessPolicy;
  student: StudentPolicySnapshot;
  authenticatorPresented: boolean;
}): AccessPolicyFailure | null {
  const { requiresAuthenticator, authenticatorIsExclusive } = getPolicyForEvent(policy, eventType);

  if (requiresAuthenticator && authenticatorIsExclusive && !authenticatorPresented) {
    return 'AUTHENTICATOR_REQUIRED';
  }

  if (eventType === 'INGRESO' && student.is_in_institution) {
    return 'ENTRY_ALREADY_ACTIVE';
  }

  if (eventType === 'SALIDA') {
    if (!student.is_in_institution) {
      return 'EXIT_WITHOUT_ACTIVE_ENTRY';
    }

    if (exitKind === 'SOLO' && !student.can_leave_alone) {
      return 'EXIT_NOT_ALLOWED_ALONE';
    }

    if (
      policy.exit_requires_authenticator &&
      policy.exit_requires_observation_without_authenticator &&
      !authenticatorPresented &&
      !notes
    ) {
      return 'EXIT_OBSERVATION_REQUIRED';
    }
  }

  return null;
}

function buildContingencyNotes(notes: string, contingencyReason: string) {
  const reasonLabel = CONTINGENCY_REASON_MESSAGES[contingencyReason] ?? contingencyReason;
  return [
    notes,
    `Contingencia por ausencia de dispositivo: ${reasonLabel}`,
  ]
    .filter(Boolean)
    .join(' | ');
}

const POLICY_FAILURE_MESSAGES: Record<AccessPolicyFailure, string> = {
  AUTHENTICATOR_REQUIRED: 'La política exige QR o PIN para este evento',
  ENTRY_ALREADY_ACTIVE: 'El estudiante ya registra un ingreso activo',
  EXIT_WITHOUT_ACTIVE_ENTRY: 'El estudiante no tiene un ingreso activo',
  EXIT_NOT_ALLOWED_ALONE: 'El estudiante no está autorizado para salir solo',
  EXIT_OBSERVATION_REQUIRED: 'Debes agregar una observación si registras salida sin autenticador',
  VALIDATION_ERROR: 'El evento no cumple las reglas de validación',
};

export async function recordAccessEventAction(formData: FormData) {
  const selectionMode = String(formData.get('selection_mode') ?? 'student');

  const studentIdsFromArray = formData
    .getAll('student_ids')
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);

  const singleStudentId = Number(formData.get('student_id'));

  const studentIds =
    selectionMode === 'course'
      ? studentIdsFromArray
      : Number.isFinite(singleStudentId) && singleStudentId > 0
        ? [singleStudentId]
        : [];

  const eventType = String(formData.get('event_type') ?? '').trim();
  const exitKindValue = String(formData.get('exit_kind') ?? '').trim();
  const validationKind = String(formData.get('validation_kind') ?? '').trim();
  const contingencyMode = String(formData.get('contingency_mode') ?? 'NORMAL').trim();
  const contingencyReason = String(formData.get('contingency_reason') ?? '').trim();
  const result = String(formData.get('result') ?? '').trim();
  const notes = String(formData.get('notes') ?? '').trim();
  const authenticatorPresented = AUTHENTICATOR_METHODS.has(validationKind);
  const usingContingency = contingencyMode === 'CONTINGENCIA_SIN_DISPOSITIVO';

  const validationErrors: string[] = [];

  if (selectionMode === 'student' && studentIds.length === 0) {
    validationErrors.push('Debes seleccionar un estudiante');
  }

  if (selectionMode === 'course' && studentIds.length === 0) {
    validationErrors.push('Debes seleccionar al menos un estudiante del curso');
  }

  if (!eventType) {
    validationErrors.push('Debes seleccionar un evento');
  }

  if (!validationKind) {
    validationErrors.push('Debes seleccionar un método de validación');
  }

  if (usingContingency) {
    if (validationKind !== 'MANUAL') {
      validationErrors.push('La contingencia sin dispositivo solo se permite con validación manual');
    }

    if (!contingencyReason) {
      validationErrors.push('Debes indicar el motivo de contingencia');
    }

    if (!notes) {
      validationErrors.push('Debes registrar una observación para la contingencia');
    }
  }

  if (!result) {
    validationErrors.push('Debes seleccionar un resultado');
  }

  if (eventType === 'SALIDA' && !exitKindValue) {
    validationErrors.push('Debes seleccionar un tipo de salida');
  }

  if (validationErrors.length > 0) {
    redirect(`/guard?message=${encodeURIComponent(validationErrors.join('. '))}`);
  }

  const { user, profile } = await requireStaff();
  const supabase = await createClient();

  const institutionId = profile?.institution_id;

  if (!institutionId) {
    redirect('/guard?message=No+hay+institución+asignada+para+registrar+eventos');
  }

  const { data: policyData } = await supabase
    .from('institution_access_policies')
    .select(
      'entry_requires_authenticator, entry_authenticator_is_exclusive, exit_requires_authenticator, exit_authenticator_is_exclusive, exit_requires_observation_without_authenticator',
    )
    .eq('institution_id', institutionId)
    .maybeSingle();

  const policy: AccessPolicy = {
    ...DEFAULT_ACCESS_POLICY,
    ...(policyData ?? {}),
  };

  const { data: selectedStudents } = await supabase
    .from('students')
    .select('id, first_name, last_name, is_in_institution, can_leave_alone')
    .in('id', studentIds)
    .eq('institution_id', institutionId);

  const studentsById = new Map(
    ((selectedStudents ?? []) as StudentPolicySnapshot[]).map((student) => [student.id, student]),
  );

  const missingStudentIds = studentIds.filter((studentId) => !studentsById.has(studentId));
  if (missingStudentIds.length > 0) {
    redirect('/guard?message=Uno+o+más+estudiantes+no+pertenecen+a+tu+institución');
  }

  const { requiresAuthenticator } = getPolicyForEvent(policy, eventType);
  const policySnapshot = {
    entry_requires_authenticator: policy.entry_requires_authenticator,
    entry_authenticator_is_exclusive: policy.entry_authenticator_is_exclusive,
    exit_requires_authenticator: policy.exit_requires_authenticator,
    exit_authenticator_is_exclusive: policy.exit_authenticator_is_exclusive,
    exit_requires_observation_without_authenticator:
      policy.exit_requires_observation_without_authenticator,
  };

  const failures = studentIds
    .map((studentId) => {
      const student = studentsById.get(studentId);
      if (!student) return null;

      const failure = resolvePolicyFailure({
        eventType,
        exitKind: exitKindValue,
        notes,
        policy,
        student,
        authenticatorPresented,
      });

      return failure ? { student, failure } : null;
    })
    .filter((failure): failure is { student: StudentPolicySnapshot; failure: AccessPolicyFailure } =>
      Boolean(failure),
    );

  const approvedStudentIds = studentIds.filter(
    (studentId) => !failures.some((failure) => failure.student.id === studentId),
  );

  const rejectedPayload = failures.map(({ student, failure }) => ({
    student_id: student.id,
    recorded_by_profile_id: user.id,
    event_type: eventType,
    validation_kind: validationKind,
    result: 'RECHAZADO',
    notes: [
      usingContingency ? buildContingencyNotes(notes, contingencyReason || 'OTRO') : notes,
      POLICY_FAILURE_MESSAGES[failure],
    ]
      .filter(Boolean)
      .join(' | ')
      || null,
    policy_failure: failure,
    authenticator_required: requiresAuthenticator,
    authenticator_presented: authenticatorPresented,
    policy_snapshot: policySnapshot,
    ...(eventType === 'SALIDA' ? { exit_kind: exitKindValue } : {}),
  }));

  const approvedPayload = approvedStudentIds.map((studentId) => ({
    student_id: studentId,
    recorded_by_profile_id: user.id,
    event_type: eventType,
    validation_kind: validationKind,
    result,
    notes: usingContingency ? buildContingencyNotes(notes, contingencyReason || 'OTRO') : notes || null,
    policy_failure: null,
    authenticator_required: requiresAuthenticator,
    authenticator_presented: authenticatorPresented,
    policy_snapshot: policySnapshot,
    ...(eventType === 'SALIDA' ? { exit_kind: exitKindValue } : {}),
  }));

  const payload = [...rejectedPayload, ...approvedPayload];

  if (payload.length === 0) {
    redirect('/guard?message=No+se+encontraron+estudiantes+aprobados+o+rechazados');
  }

  const { error } = await supabase.from('access_events').insert(payload);

  if (error) {
    const msg = encodeURIComponent(`No se pudo registrar el evento: ${error.message}`);
    redirect(`/guard?message=${msg}`);
  }

  revalidatePath('/guard');
  revalidatePath('/dashboard');

  const successMessage =
    failures.length > 0
      ? `Evento auditado: ${approvedStudentIds.length} aprobado(s), ${failures.length} rechazado(s)`
      : studentIds.length === 1
        ? 'Evento registrado'
        : `Eventos registrados para ${studentIds.length} estudiantes`;

  redirect(`/guard?message=${encodeURIComponent(successMessage)}`);
}
