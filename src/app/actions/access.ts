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
const EXIT_KINDS = new Set(['REGULAR', 'RETIRO_AUTORIZADO', 'SOLO', 'EXCEPCIONAL']);

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

  if (eventType === 'INGRESO' && student.is_in_institution) {
    return 'ENTRY_ALREADY_ACTIVE';
  }

  if (eventType === 'SALIDA') {
    if (!student.is_in_institution) {
      return 'EXIT_WITHOUT_ACTIVE_ENTRY';
    }

    if (exitKind === 'EXCEPCIONAL') {
      return null;
    }

    if (requiresAuthenticator && authenticatorIsExclusive && !authenticatorPresented) {
      return 'AUTHENTICATOR_REQUIRED';
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

  if (eventType === 'INGRESO' && requiresAuthenticator && authenticatorIsExclusive && !authenticatorPresented) {
    return 'AUTHENTICATOR_REQUIRED';
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

  if (eventType === 'SALIDA' && exitKindValue && !EXIT_KINDS.has(exitKindValue)) {
    validationErrors.push('El tipo de salida seleccionado no es válido');
  }

  if (eventType === 'SALIDA' && exitKindValue === 'EXCEPCIONAL' && !notes) {
    validationErrors.push('Debes registrar una observación para la salida excepcional');
  }

  if (validationErrors.length > 0) {
    redirect(`/guard?message=${encodeURIComponent(validationErrors.join('. '))}`);
  }

  const { user, profile } = await requireStaff();
  const supabase = await createClient();

  if (!['ADMIN', 'PORTERIA'].includes(profile.role)) {
    redirect('/guard?message=No+tienes+permiso+para+registrar+eventos');
  }

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

  const { requiresAuthenticator, authenticatorIsExclusive } = getPolicyForEvent(policy, eventType);
  const isExceptionalExit = eventType === 'SALIDA' && exitKindValue === 'EXCEPCIONAL';
  const selectedStudentSnapshots = studentIds
    .map((studentId) => studentsById.get(studentId))
    .filter((student): student is StudentPolicySnapshot => Boolean(student));
  const shouldRequestGuardianApproval =
    eventType === 'SALIDA' &&
    exitKindValue === 'SOLO' &&
    result === 'APROBADO' &&
    usingContingency &&
    requiresAuthenticator &&
    authenticatorIsExclusive &&
    !authenticatorPresented &&
    selectedStudentSnapshots.length > 0 &&
    selectedStudentSnapshots.every((student) => student.is_in_institution && student.can_leave_alone);

  if (shouldRequestGuardianApproval) {
    const { data: guardianLinks, error: guardianLinksError } = await supabase
      .from('guardian_students')
      .select('student_id, guardian_profile_id, relation_type, created_at')
      .in('student_id', studentIds)
      .order('created_at', { ascending: true });

    if (guardianLinksError) {
      redirect('/guard?message=No+se+pudieron+consultar+los+apoderados+vinculados');
    }

    const guardiansByStudent = new Map<number, { guardian_profile_id: string; relation_type: string | null }>();
    for (const link of guardianLinks ?? []) {
      const studentId = Number(link.student_id);
      const current = guardiansByStudent.get(studentId);
      if (!current || (link.relation_type === 'APODERADO_PRINCIPAL' && current.relation_type !== 'APODERADO_PRINCIPAL')) {
        guardiansByStudent.set(studentId, {
          guardian_profile_id: String(link.guardian_profile_id),
          relation_type: link.relation_type,
        });
      }
    }

    if (studentIds.some((studentId) => !guardiansByStudent.has(studentId))) {
      redirect('/guard?message=No+hay+un+apoderado+vinculado+para+autorizar+la+contingencia');
    }

    const { data: existingPending, error: existingPendingError } = await supabase
      .from('authorization_requests')
      .select('student_id')
      .in('student_id', studentIds)
      .eq('status', 'PENDING')
      .gt('expires_at', new Date().toISOString());

    if (existingPendingError) {
      redirect('/guard?message=No+se+pudieron+consultar+las+solicitudes+pendientes');
    }

    const pendingStudentIds = new Set((existingPending ?? []).map((request) => Number(request.student_id)));
    const requestsToCreate = studentIds
      .filter((studentId) => !pendingStudentIds.has(studentId))
      .map((studentId) => ({
        institution_id: institutionId,
        student_id: studentId,
        guardian_profile_id: guardiansByStudent.get(studentId)!.guardian_profile_id,
        requested_by_profile_id: user.id,
        request_type: 'EXIT_CONTINGENCY',
        status: 'PENDING',
        reason: buildContingencyNotes(notes, contingencyReason || 'OTRO'),
        contingency_reason: contingencyReason || 'OTRO',
        contingency_note: notes,
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      }));

    if (requestsToCreate.length > 0) {
      const { error: requestError } = await supabase
        .from('authorization_requests')
        .insert(requestsToCreate);

      if (requestError) {
        redirect(`/guard?message=${encodeURIComponent(`No se pudo solicitar autorización: ${requestError.message}`)}`);
      }
    }

    revalidatePath('/guard');
    revalidatePath('/dashboard');
    redirect(`/guard?message=${encodeURIComponent(
      requestsToCreate.length > 0
        ? `Solicitud de contingencia enviada al apoderado para ${requestsToCreate.length} estudiante(s)`
        : 'La solicitud de contingencia ya está pendiente de respuesta',
    )}`);
  }

  const eventRequiresAuthenticator = requiresAuthenticator && !isExceptionalExit;
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
    authenticator_required: eventRequiresAuthenticator,
    authenticator_presented: authenticatorPresented,
    policy_snapshot: policySnapshot,
    access_mode: usingContingency ? 'CONTINGENCIA_SIN_DISPOSITIVO' : 'NORMAL',
    contingency_reason: usingContingency ? contingencyReason || 'OTRO' : null,
    contingency_note: usingContingency ? notes : null,
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
    authenticator_required: eventRequiresAuthenticator,
    authenticator_presented: authenticatorPresented,
    policy_snapshot: policySnapshot,
    access_mode: usingContingency ? 'CONTINGENCIA_SIN_DISPOSITIVO' : 'NORMAL',
    contingency_reason: usingContingency ? contingencyReason || 'OTRO' : null,
    contingency_note: usingContingency ? notes : null,
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
