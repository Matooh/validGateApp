import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

import { credentialsFor, E2E_ROLES, getE2EConfig, type E2ERole } from './env';

type StudentKey = 'inside' | 'outside';

const roleNames: Record<E2ERole, [string, string]> = {
  ADMIN: ['Admin', 'E2E'],
  PORTERIA: ['Portería', 'E2E'],
  DOCENTE: ['Docente', 'E2E'],
  APODERADO: ['Apoderado', 'E2E'],
  ESTUDIANTE: ['Estudiante', 'E2E'],
};

function client(): SupabaseClient {
  const config = getE2EConfig();
  return createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function codes() {
  const suffix = getE2EConfig().namespace.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 14);
  return {
    institution: `VALIDGATE E2E ${getE2EConfig().namespace}`,
    course: `Curso E2E ${getE2EConfig().namespace}`,
    inside: `E2E-${suffix}-IN`,
    outside: `E2E-${suffix}-OUT`,
  };
}

async function assertNoError(label: string, error: { message: string } | null) {
  if (error) throw new Error(`${label}: ${error.message}`);
}

function requireData<T>(label: string, data: T | null): T {
  if (data === null) throw new Error(`${label}: la respuesta no contiene datos.`);
  return data;
}

async function findAuthUser(db: SupabaseClient, email: string): Promise<User | null> {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 100 });
    await assertNoError('No se pudieron consultar usuarios Auth', error);
    const found = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (data.users.length < 100) return null;
  }
  throw new Error('La búsqueda de usuarios Auth excedió 1000 registros; ajusta el preparador E2E.');
}

async function ensureInstitution(db: SupabaseClient) {
  const names = codes();
  const { data: existing, error: readError } = await db
    .from('institutions')
    .select('id, name')
    .eq('name', names.institution)
    .limit(2);
  await assertNoError('No se pudo consultar la institución E2E', readError);
  if ((existing ?? []).length > 1) throw new Error('Existe más de una institución con el nombre E2E configurado.');
  if (existing?.[0]) return Number(existing[0].id);

  const { data, error } = await db
    .from('institutions')
    .insert({ name: names.institution, institution_type: 'COLEGIO_E2E' })
    .select('id')
    .single();
  await assertNoError('No se pudo crear la institución E2E', error);
  return Number(requireData('No se pudo crear la institución E2E', data).id);
}

async function ensureCourse(db: SupabaseClient, institutionId: number) {
  const { course } = codes();
  const { data: existing, error: readError } = await db
    .from('courses')
    .select('id')
    .eq('institution_id', institutionId)
    .eq('name', course)
    .maybeSingle();
  await assertNoError('No se pudo consultar el curso E2E', readError);
  if (existing) return Number(existing.id);

  const { data, error } = await db
    .from('courses')
    .insert({ institution_id: institutionId, name: course })
    .select('id')
    .single();
  await assertNoError('No se pudo crear el curso E2E', error);
  return Number(requireData('No se pudo crear el curso E2E', data).id);
}

async function ensureUser(db: SupabaseClient, role: E2ERole, institutionId: number) {
  const config = getE2EConfig();
  const credentials = credentialsFor(role);
  const [firstName, lastName] = roleNames[role];
  let user = await findAuthUser(db, credentials.email);

  if (!user) {
    const { data, error } = await db.auth.admin.createUser({
      email: credentials.email,
      password: credentials.password,
      email_confirm: true,
      user_metadata: { first_name: firstName, last_name: lastName },
      app_metadata: { validgate_e2e: true, e2e_namespace: config.namespace },
    });
    await assertNoError(`No se pudo crear el usuario ${role}`, error);
    user = requireData(`No se pudo crear el usuario ${role}`, data.user);
  }

  user = requireData(`No se pudo resolver el usuario ${role}`, user);

  const managed =
    user.app_metadata?.validgate_e2e === true &&
    user.app_metadata?.e2e_namespace === config.namespace;

  if (managed) {
    const { error: authError } = await db.auth.admin.updateUserById(user.id, {
      password: credentials.password,
      email_confirm: true,
      user_metadata: { first_name: firstName, last_name: lastName },
    });
    await assertNoError(`No se pudo actualizar el usuario E2E ${role}`, authError);

    const { error: profileError } = await db.from('profiles').upsert({
      id: user.id,
      institution_id: institutionId,
      first_name: firstName,
      last_name: lastName,
      email: credentials.email,
      role,
    });
    await assertNoError(`No se pudo preparar el perfil ${role}`, profileError);
    return user.id;
  }

  const { data: profile, error: profileError } = await db
    .from('profiles')
    .select('role, institution_id')
    .eq('id', user.id)
    .single();
  await assertNoError(`No se pudo validar el perfil existente ${role}`, profileError);
  const resolvedProfile = requireData(`No se pudo validar el perfil existente ${role}`, profile);
  if (resolvedProfile.role !== role || Number(resolvedProfile.institution_id) !== institutionId) {
    throw new Error(
      `${role}: el correo ya existe y no está marcado como E2E con el rol/institución esperados. No se modificó.`,
    );
  }
  return user.id;
}

async function ensureStudent(
  db: SupabaseClient,
  key: StudentKey,
  institutionId: number,
  courseId: number,
) {
  const linkCode = codes()[key];
  const expected = key === 'inside'
    ? { first_name: 'Estudiante', last_name: 'E2E Dentro' }
    : { first_name: 'Estudiante', last_name: 'E2E Fuera' };
  const { data: existing, error: readError } = await db
    .from('students')
    .select('id, institution_id, first_name, last_name')
    .eq('link_code', linkCode)
    .maybeSingle();
  await assertNoError(`No se pudo consultar el estudiante E2E ${key}`, readError);
  if (existing) {
    if (
      Number(existing.institution_id) !== institutionId ||
      existing.first_name !== expected.first_name ||
      existing.last_name !== expected.last_name
    ) {
      throw new Error(`El código ${linkCode} ya pertenece a datos no coincidentes. No se modificó.`);
    }
    return Number(existing.id);
  }

  const { data, error } = await db
    .from('students')
    .insert({
      institution_id: institutionId,
      course_id: courseId,
      ...expected,
      can_leave_alone: false,
      is_in_institution: key === 'inside',
      link_code: linkCode,
    })
    .select('id')
    .single();
  await assertNoError(`No se pudo crear el estudiante E2E ${key}`, error);
  return Number(requireData(`No se pudo crear el estudiante E2E ${key}`, data).id);
}

export async function ensureE2EData() {
  const db = client();
  const institutionId = await ensureInstitution(db);
  const courseId = await ensureCourse(db, institutionId);
  const userIds = {} as Record<E2ERole, string>;
  for (const role of E2E_ROLES) userIds[role] = await ensureUser(db, role, institutionId);

  const insideId = await ensureStudent(db, 'inside', institutionId, courseId);
  const outsideId = await ensureStudent(db, 'outside', institutionId, courseId);

  await assertNoError(
    'No se pudo vincular el perfil del estudiante E2E',
    (await db.from('student_profiles').upsert(
      { profile_id: userIds.ESTUDIANTE, student_id: insideId, institution_id: institutionId },
      { onConflict: 'profile_id' },
    )).error,
  );
  await assertNoError(
    'No se pudo limpiar el vínculo del apoderado E2E',
    (await db.from('guardian_students').delete()
      .eq('guardian_profile_id', userIds.APODERADO)
      .eq('student_id', insideId)
      .eq('relation_type', 'APODERADO')).error,
  );
  await assertNoError(
    'No se pudo vincular el apoderado E2E',
    (await db.from('guardian_students').insert(
      { guardian_profile_id: userIds.APODERADO, student_id: insideId, relation_type: 'APODERADO' },
    )).error,
  );
  await assertNoError(
    'No se pudo preparar la política E2E',
    (await db.from('institution_access_policies').upsert({
      institution_id: institutionId,
      entry_requires_authenticator: false,
      entry_authenticator_is_exclusive: false,
      exit_requires_authenticator: false,
      exit_authenticator_is_exclusive: false,
      exit_requires_observation_without_authenticator: false,
    })).error,
  );
  await assertNoError(
    'No se pudo preparar la configuración de retiro E2E',
    (await db.from('institution_pickup_settings').upsert({
      institution_id: institutionId,
      pin_ttl_minutes: 5,
      max_pin_attempts: 3,
      student_notification_message: '{guardian_name} está esperando por ti',
    })).error,
  );

  await resetE2EState();
  return { institutionId, courseId, userIds, students: { inside: insideId, outside: outsideId }, codes: codes() };
}

export async function resolveE2EData() {
  const db = client();
  const names = codes();
  const { data: institution, error: institutionError } = await db
    .from('institutions').select('id').eq('name', names.institution).single();
  await assertNoError('No existe la institución E2E', institutionError);
  const { data: students, error: studentsError } = await db
    .from('students').select('id, link_code').in('link_code', [names.inside, names.outside]);
  await assertNoError('No se pudieron resolver los estudiantes E2E', studentsError);
  const byCode = new Map(requireData('No se pudieron resolver los estudiantes E2E', students).map((item) => [item.link_code, Number(item.id)]));
  const resolvedInstitution = requireData('No existe la institución E2E', institution);
  return {
    db,
    institutionId: Number(resolvedInstitution.id),
    students: { inside: byCode.get(names.inside)!, outside: byCode.get(names.outside)! },
    codes: names,
  };
}

export async function resetE2EState() {
  const { db, institutionId, students } = await resolveE2EData();
  const studentIds = [students.inside, students.outside];

  await assertNoError('No se pudieron limpiar autorizaciones E2E',
    (await db.from('student_exit_authorizations').delete().in('student_id', studentIds)).error);
  await assertNoError('No se pudieron limpiar solicitudes de autorización E2E',
    (await db.from('authorization_requests').delete().in('student_id', studentIds)).error);
  await assertNoError('No se pudieron limpiar retiros E2E',
    (await db.from('guardian_pickup_requests').delete().in('student_id', studentIds)).error);
  await assertNoError('No se pudieron limpiar notificaciones E2E',
    (await db.from('internal_notifications').delete().eq('institution_id', institutionId)).error);
  await assertNoError('No se pudieron limpiar credenciales E2E',
    (await db.from('student_qr_credentials').delete().in('student_id', studentIds)).error);
  await assertNoError('No se pudieron limpiar eventos E2E',
    (await db.from('access_events').delete().in('student_id', studentIds)).error);

  await assertNoError('No se pudo restablecer el estudiante dentro',
    (await db.from('students').update({ is_in_institution: true, can_leave_alone: false }).eq('id', students.inside)).error);
  await assertNoError('No se pudo restablecer el estudiante fuera',
    (await db.from('students').update({ is_in_institution: false, can_leave_alone: false }).eq('id', students.outside)).error);
  await assertNoError('No se pudo restablecer la política E2E',
    (await db.from('institution_access_policies').update({
      entry_requires_authenticator: false,
      entry_authenticator_is_exclusive: false,
      exit_requires_authenticator: false,
      exit_authenticator_is_exclusive: false,
      exit_requires_observation_without_authenticator: false,
    }).eq('institution_id', institutionId)).error);

  const guardian = credentialsFor('APODERADO');
  const { data: guardianProfile, error: guardianError } = await db
    .from('profiles').select('id').eq('email', guardian.email).single();
  await assertNoError('No se pudo resolver el apoderado E2E', guardianError);
  const resolvedGuardian = requireData('No se pudo resolver el apoderado E2E', guardianProfile);
  await assertNoError('No se pudo limpiar la vinculación temporal E2E',
    (await db.from('guardian_students').delete()
      .eq('guardian_profile_id', resolvedGuardian.id).eq('student_id', students.outside)).error);
}

export async function setStudentState(key: StudentKey, values: { inside?: boolean; canLeaveAlone?: boolean }) {
  const { db, students } = await resolveE2EData();
  const payload: Record<string, boolean> = {};
  if (values.inside !== undefined) payload.is_in_institution = values.inside;
  if (values.canLeaveAlone !== undefined) payload.can_leave_alone = values.canLeaveAlone;
  await assertNoError('No se pudo preparar el estado del estudiante E2E',
    (await db.from('students').update(payload).eq('id', students[key])).error);
}

export async function isOutsideStudentLinkedToGuardian() {
  const { db, students } = await resolveE2EData();
  const guardian = credentialsFor('APODERADO');
  const { data: guardianProfile, error: guardianError } = await db
    .from('profiles').select('id').eq('email', guardian.email).single();
  await assertNoError('No se pudo resolver el apoderado E2E', guardianError);
  const resolvedGuardian = requireData('No se pudo resolver el apoderado E2E', guardianProfile);
  const { data, error } = await db.from('guardian_students').select('id')
    .eq('guardian_profile_id', resolvedGuardian.id).eq('student_id', students.outside).maybeSingle();
  await assertNoError('No se pudo consultar la vinculaciÃ³n temporal E2E', error);
  return Boolean(data);
}

export async function removeOutsideStudentGuardianLink() {
  const { db, students } = await resolveE2EData();
  const guardian = credentialsFor('APODERADO');
  const { data: guardianProfile, error: guardianError } = await db
    .from('profiles').select('id').eq('email', guardian.email).single();
  await assertNoError('No se pudo resolver el apoderado E2E', guardianError);
  const resolvedGuardian = requireData('No se pudo resolver el apoderado E2E', guardianProfile);
  await assertNoError('No se pudo eliminar la vinculaciÃ³n temporal E2E',
    (await db.from('guardian_students').delete()
      .eq('guardian_profile_id', resolvedGuardian.id).eq('student_id', students.outside)).error);
}

export async function setExitPolicy(requiresAuthenticator: boolean, exclusive: boolean) {
  const { db, institutionId } = await resolveE2EData();
  await assertNoError('No se pudo configurar la política de salida E2E',
    (await db.from('institution_access_policies').update({
      exit_requires_authenticator: requiresAuthenticator,
      exit_authenticator_is_exclusive: exclusive,
      exit_requires_observation_without_authenticator: false,
    }).eq('institution_id', institutionId)).error);
}

export async function latestQrPayload() {
  const { db, students } = await resolveE2EData();
  const { data, error } = await db.from('student_qr_credentials')
    .select('id').eq('student_id', students.inside).is('used_at', null).is('revoked_at', null)
    .order('created_at', { ascending: false }).limit(1).single();
  await assertNoError('No se pudo recuperar la credencial QR E2E para simular el escáner', error);
  return `validgate-auth:${requireData('No se pudo recuperar la credencial QR E2E', data).id}`;
}
