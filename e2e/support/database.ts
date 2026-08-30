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

function secondaryGuardianEmail() {
  const namespace = getE2EConfig().namespace.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 24);
  return `apoderado.secundario.${namespace}@example.invalid`;
}

const SECONDARY_GUARDIAN_PASSWORD = 'ValidGate-E2E-Secondary-2026!';
const TRACEABILITY_PASSWORD = 'ValidGate-E2E-Traceability-2026!';

function traceabilityMarker() {
  return `PF-TRA-002-${getE2EConfig().namespace}`;
}

function traceabilityEmail(kind: 'student' | 'teacher') {
  const namespace = getE2EConfig().namespace.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 22);
  return `${kind}.trazabilidad.${namespace}@example.invalid`;
}

async function ensureTraceabilityUser(
  db: SupabaseClient,
  kind: 'student' | 'teacher',
  institutionId: number,
) {
  const email = traceabilityEmail(kind);
  const role: E2ERole = kind === 'student' ? 'ESTUDIANTE' : 'DOCENTE';
  const firstName = kind === 'student' ? 'Estudiante' : 'Docente';
  const lastName = kind === 'student' ? 'E2E Familia B' : 'Secundario E2E';
  let user = await findAuthUser(db, email);

  if (!user) {
    const { data, error } = await db.auth.admin.createUser({
      email,
      password: TRACEABILITY_PASSWORD,
      email_confirm: true,
      user_metadata: { first_name: firstName, last_name: lastName },
      app_metadata: { validgate_e2e: true, e2e_namespace: getE2EConfig().namespace },
    });
    await assertNoError(`No se pudo crear el ${kind} de trazabilidad E2E`, error);
    user = requireData(`No se creó el ${kind} de trazabilidad E2E`, data.user);
  }

  await assertNoError(`No se pudo actualizar el acceso del ${kind} de trazabilidad E2E`,
    (await db.auth.admin.updateUserById(user.id, {
      password: TRACEABILITY_PASSWORD,
      email_confirm: true,
      user_metadata: { first_name: firstName, last_name: lastName },
    })).error);
  await assertNoError(`No se pudo preparar el perfil del ${kind} de trazabilidad E2E`,
    (await db.from('profiles').upsert({
      id: user.id,
      institution_id: institutionId,
      first_name: firstName,
      last_name: lastName,
      email,
      role,
    })).error);

  return { profileId: user.id, email, password: TRACEABILITY_PASSWORD, role, name: `${firstName} ${lastName}` };
}

function retrieverIdentity(kind: 'existing' | 'new') {
  const namespace = getE2EConfig().namespace.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20);
  const seed = `${namespace}-${kind}`;
  let hash = 0;
  for (const character of seed) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  const body = 10_000_000 + (hash % 9_000_000);
  let sum = 0;
  let multiplier = 2;
  for (const digit of String(body).split('').reverse()) {
    sum += Number(digit) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  const calculated = 11 - (sum % 11);
  const verifier = calculated === 11 ? '0' : calculated === 10 ? 'K' : String(calculated);
  return {
    email: `retirador.${kind}.${namespace}@example.invalid`,
    password: 'ValidGate-E2E-Retirador-2026!',
    rut: `${body}-${verifier}`,
    firstName: kind === 'new' ? 'Apoderado Secundario Nuevo' : 'Apoderado Secundario',
    lastName: 'E2E',
  };
}

export function retrieverFixture(kind: 'existing' | 'new' = 'existing') {
  return retrieverIdentity(kind);
}

export async function removeRetrieverFixture(kind: 'existing' | 'new') {
  const db = client();
  const identity = retrieverIdentity(kind);
  const user = await findAuthUser(db, identity.email);
  if (!user) return;
  await assertNoError(`No se pudieron limpiar vínculos del retirador ${kind}`,
    (await db.from('guardian_students').delete().eq('guardian_profile_id', user.id)).error);
  const { error } = await db.auth.admin.deleteUser(user.id);
  await assertNoError(`No se pudo eliminar el usuario retirador ${kind}`, error);
}

export async function ensureExistingRetriever(options: { authorize?: boolean } = {}) {
  const { db, institutionId, students } = await resolveE2EData();
  const identity = retrieverIdentity('existing');
  let user = await findAuthUser(db, identity.email);
  if (!user) {
    const { data, error } = await db.auth.admin.createUser({
      email: identity.email,
      password: identity.password,
      email_confirm: true,
      user_metadata: { first_name: identity.firstName, last_name: identity.lastName },
      app_metadata: { validgate_e2e: true, e2e_namespace: getE2EConfig().namespace },
    });
    await assertNoError('No se pudo crear el retirador E2E', error);
    user = requireData('No se pudo crear el retirador E2E', data.user);
  }
  await assertNoError('No se pudo preparar el perfil del retirador E2E',
    (await db.from('profiles').upsert({
      id: user.id,
      institution_id: institutionId,
      first_name: identity.firstName,
      last_name: identity.lastName,
      email: identity.email,
      rut: identity.rut,
      role: 'RETIRADOR_AUTORIZADO',
    })).error);
  await assertNoError('No se pudieron limpiar autorizaciones anteriores del retirador E2E',
    (await db.from('guardian_students').delete().eq('guardian_profile_id', user.id)).error);
  let relationId: number | null = null;
  if (options.authorize) {
    const guardian = credentialsFor('APODERADO');
    const { data: guardianProfile, error: guardianError } = await db.from('profiles').select('id').eq('email', guardian.email).single();
    await assertNoError('No se pudo resolver el apoderado autorizante E2E', guardianError);
    const { data: relation, error } = await db.from('guardian_students').insert({
      guardian_profile_id: user.id,
      student_id: students.inside,
      relation_type: 'RETIRADOR_AUTORIZADO',
      authorized_by_profile_id: requireData('No se resolvió el apoderado E2E', guardianProfile).id,
      valid_from: new Date(Date.now() - 60_000).toISOString(),
      valid_until: new Date(Date.now() + 60 * 60_000).toISOString(),
    }).select('id').single();
    await assertNoError('No se pudo autorizar el retirador E2E', error);
    relationId = Number(requireData('No se creó la autorización E2E', relation).id);
  }
  return { ...identity, profileId: user.id, relationId, studentId: students.inside };
}

export async function activateNewRetrieverAccount() {
  const db = client();
  const identity = retrieverIdentity('new');
  const user = await findAuthUser(db, identity.email);
  if (!user) throw new Error('El formulario no creó la cuenta del retirador nuevo.');
  await assertNoError('No se pudo activar la cuenta nueva del retirador E2E',
    (await db.auth.admin.updateUserById(user.id, { password: identity.password, email_confirm: true })).error);
  const { data: profile, error } = await db.from('profiles')
    .select('id, rut, role').eq('id', user.id).single();
  await assertNoError('No se pudo comprobar el perfil del retirador nuevo', error);
  const resolved = requireData('No existe el perfil del retirador nuevo', profile);
  if (resolved.rut !== identity.rut || resolved.role !== 'RETIRADOR_AUTORIZADO') {
    throw new Error('El perfil nuevo no conserva el RUT y rol esperados.');
  }
  return { ...identity, profileId: user.id };
}

export async function pickupStateForRetriever(profileId: string) {
  const { db, students } = await resolveE2EData();
  const { data: requests, error } = await db.from('guardian_pickup_requests')
    .select('id, status, authorization_link_id').eq('guardian_profile_id', profileId)
    .eq('student_id', students.inside).order('created_at', { ascending: false }).limit(1);
  await assertNoError('No se pudo consultar el retiro del retirador E2E', error);
  const request = requests?.[0] ?? null;
  if (!request) return null;
  const { count, error: eventError } = await db.from('access_events').select('id', { count: 'exact', head: true })
    .eq('student_id', students.inside).eq('event_type', 'SALIDA').eq('exit_kind', 'RETIRO_AUTORIZADO');
  await assertNoError('No se pudieron contar los eventos de retiro E2E', eventError);
  return { ...request, accessEventCount: count ?? 0 };
}

export async function revokeRetrieverRelationDirect(relationId: number) {
  const db = client();
  await assertNoError('No se pudo revocar directamente la autorización E2E',
    (await db.from('guardian_students').update({ revoked_at: new Date().toISOString() }).eq('id', relationId)).error);
}

export async function validatePickupPinAsPorteria(
  requestId: string,
  actorType: 'GUARDIAN' | 'STUDENT',
  pin: string,
) {
  const config = getE2EConfig();
  const porteria = credentialsFor('PORTERIA');
  const db = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: loginError } = await db.auth.signInWithPassword(porteria);
  await assertNoError('No se pudo autenticar portería para validar el PIN E2E', loginError);
  const { data, error } = await db.rpc('validate_guardian_pickup_pin', {
    p_request_id: requestId,
    p_actor_type: actorType,
    p_pin: pin,
  });
  await assertNoError('No se pudo ejecutar la validación de PIN E2E', error);
  return (Array.isArray(data) ? data[0] : data) as { request_id: string; message_code: string };
}

export async function requestPickupAsRetriever(profileId: string, password: string, studentId: number) {
  const config = getE2EConfig();
  const db = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: profile, error: profileError } = await client().from('profiles').select('email').eq('id', profileId).single();
  await assertNoError('No se pudo resolver el correo del retirador E2E', profileError);
  const { error: loginError } = await db.auth.signInWithPassword({
    email: requireData('No existe el perfil del retirador E2E', profile).email,
    password,
  });
  await assertNoError('No se pudo autenticar el retirador E2E', loginError);
  const { data, error } = await db.rpc('create_guardian_pickup_request', { p_student_id: studentId });
  await assertNoError('No se pudo solicitar el retiro E2E', error);
  return (Array.isArray(data) ? data[0] : data) as { request_id: string | null; message_code: string };
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
    'No se pudieron limpiar los retiros E2E antes de restaurar el apoderado',
    (await db.from('guardian_pickup_requests').delete().in('student_id', [insideId, outsideId])).error,
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

export type TraceabilityEventFixture = {
  id: number;
  studentName: string;
  operation: 'Ingreso' | 'Salida';
  result: 'Aprobado';
  method: 'Manual';
  note: string;
};

export async function prepareTraceabilityFixtures() {
  const { institutionId, userIds, students } = await ensureE2EData();
  const db = client();
  const marker = traceabilityMarker();
  const guardianB = await ensureSecondaryGuardianProfile();
  const studentB = await ensureTraceabilityUser(db, 'student', institutionId);
  const teacherB = await ensureTraceabilityUser(db, 'teacher', institutionId);

  await assertNoError('No se pudo preparar el vínculo de la familia B',
    (await db.from('guardian_students').insert({
      guardian_profile_id: guardianB.guardianId,
      student_id: students.outside,
      relation_type: 'APODERADO',
    })).error);
  await assertNoError('No se pudo vincular la cuenta del estudiante de la familia B',
    (await db.from('student_profiles').upsert({
      profile_id: studentB.profileId,
      student_id: students.outside,
      institution_id: institutionId,
    }, { onConflict: 'profile_id' })).error);

  const foreignInstitutionName = `VALIDGATE E2E AJENA ${getE2EConfig().namespace}`;
  const { data: existingForeignInstitution, error: foreignInstitutionReadError } = await db
    .from('institutions').select('id').eq('name', foreignInstitutionName).maybeSingle();
  await assertNoError('No se pudo consultar la institución ajena E2E', foreignInstitutionReadError);
  let foreignInstitutionId = existingForeignInstitution ? Number(existingForeignInstitution.id) : null;
  if (foreignInstitutionId === null) {
    const { data, error } = await db.from('institutions')
      .insert({ name: foreignInstitutionName, institution_type: 'COLEGIO_E2E_AJENO' })
      .select('id').single();
    await assertNoError('No se pudo crear la institución ajena E2E', error);
    foreignInstitutionId = Number(requireData('No se creó la institución ajena E2E', data).id);
  }

  const foreignCourseName = `Curso ajeno ${getE2EConfig().namespace}`;
  const { data: existingForeignCourse, error: foreignCourseReadError } = await db.from('courses')
    .select('id').eq('institution_id', foreignInstitutionId).eq('name', foreignCourseName).maybeSingle();
  await assertNoError('No se pudo consultar el curso ajeno E2E', foreignCourseReadError);
  let foreignCourseId = existingForeignCourse ? Number(existingForeignCourse.id) : null;
  if (foreignCourseId === null) {
    const { data, error } = await db.from('courses')
      .insert({ institution_id: foreignInstitutionId, name: foreignCourseName })
      .select('id').single();
    await assertNoError('No se pudo crear el curso ajeno E2E', error);
    foreignCourseId = Number(requireData('No se creó el curso ajeno E2E', data).id);
  }

  const foreignLinkCode = `${marker}-FOREIGN`.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 48);
  const { data: existingForeignStudent, error: foreignStudentReadError } = await db.from('students')
    .select('id').eq('link_code', foreignLinkCode).maybeSingle();
  await assertNoError('No se pudo consultar el estudiante ajeno E2E', foreignStudentReadError);
  let foreignStudentId = existingForeignStudent ? Number(existingForeignStudent.id) : null;
  if (foreignStudentId === null) {
    const { data, error } = await db.from('students').insert({
      institution_id: foreignInstitutionId,
      course_id: foreignCourseId,
      first_name: 'Estudiante',
      last_name: 'E2E Institución Ajena',
      can_leave_alone: false,
      is_in_institution: false,
      link_code: foreignLinkCode,
    }).select('id').single();
    await assertNoError('No se pudo crear el estudiante ajeno E2E', error);
    foreignStudentId = Number(requireData('No se creó el estudiante ajeno E2E', data).id);
  }

  await assertNoError('No se pudieron limpiar eventos anteriores de trazabilidad E2E',
    (await db.from('access_events').delete().like('notes', `${marker}%`)).error);

  const now = Date.now();
  const eventPayloads = [
    {
      student_id: students.inside,
      recorded_by_profile_id: userIds.PORTERIA,
      event_type: 'INGRESO',
      validation_kind: 'MANUAL',
      result: 'APROBADO',
      notes: `${marker} · Familia A · ingreso autorizado`,
      occurred_at: new Date(now - 60_000).toISOString(),
    },
    {
      student_id: students.outside,
      recorded_by_profile_id: userIds.PORTERIA,
      event_type: 'SALIDA',
      exit_kind: 'REGULAR',
      validation_kind: 'MANUAL',
      result: 'APROBADO',
      notes: `${marker} · Familia B · salida autorizada`,
      occurred_at: new Date(now - 120_000).toISOString(),
    },
    {
      student_id: foreignStudentId,
      event_type: 'INGRESO',
      validation_kind: 'MANUAL',
      result: 'APROBADO',
      notes: `${marker} · Institución ajena · ingreso autorizado`,
      occurred_at: new Date(now - 180_000).toISOString(),
    },
  ];
  const { data: insertedEvents, error: insertEventsError } = await db.from('access_events')
    .insert(eventPayloads).select('id, student_id, event_type, notes');
  await assertNoError('No se pudieron crear los eventos de trazabilidad E2E', insertEventsError);
  const eventsByStudent = new Map((insertedEvents ?? []).map((event) => [Number(event.student_id), event]));

  function eventFor(
    studentId: number,
    studentName: string,
    operation: 'Ingreso' | 'Salida',
  ): TraceabilityEventFixture {
    const event = eventsByStudent.get(studentId);
    if (!event) throw new Error(`No se creó el evento de trazabilidad para ${studentName}.`);
    return {
      id: Number(event.id),
      studentName,
      operation,
      result: 'Aprobado',
      method: 'Manual',
      note: String(event.notes),
    };
  }

  return {
    marker,
    institutionId,
    events: {
      familyA: eventFor(students.inside, 'Estudiante E2E Dentro', 'Ingreso'),
      familyB: eventFor(students.outside, 'Estudiante E2E Fuera', 'Salida'),
      foreign: eventFor(foreignStudentId, 'Estudiante E2E Institución Ajena', 'Ingreso'),
    },
    guardianB: {
      profileId: guardianB.guardianId,
      email: guardianB.guardianEmail,
      password: SECONDARY_GUARDIAN_PASSWORD,
      role: 'APODERADO' as const,
      name: guardianB.guardianName,
    },
    studentB,
    teacherB,
  };
}

export async function createRetrieverTraceabilityHistory(profileId: string, relationId: number) {
  const { db, institutionId, students } = await resolveE2EData();
  const timestamp = new Date(Date.now() - 30_000).toISOString();
  const { data, error } = await db.from('guardian_pickup_requests').insert({
    institution_id: institutionId,
    student_id: students.inside,
    guardian_profile_id: profileId,
    authorization_link_id: relationId,
    status: 'CANCELLED_AUTHORIZATION_REVOKED',
    expires_at: new Date(Date.now() + 5 * 60_000).toISOString(),
    cancelled_at: timestamp,
    terminal_note: 'Historial E2E conservado después de revocar la autorización.',
    created_at: timestamp,
    updated_at: timestamp,
  }).select('id').single();
  await assertNoError('No se pudo crear el historial de retiro del retirador E2E', error);
  return String(requireData('No se creó el historial del retirador E2E', data).id);
}

export async function expireRetrieverRelationDirect(relationId: number) {
  const db = client();
  await assertNoError('No se pudo vencer directamente la autorización E2E',
    (await db.from('guardian_students').update({
      revoked_at: null,
      valid_from: new Date(Date.now() - 2 * 60 * 60_000).toISOString(),
      valid_until: new Date(Date.now() - 60 * 60_000).toISOString(),
    }).eq('id', relationId)).error);
}

export async function cleanupTraceabilityFixtures() {
  const { db, students } = await resolveE2EData();
  const marker = traceabilityMarker();
  await assertNoError('No se pudieron limpiar los eventos de trazabilidad E2E',
    (await db.from('access_events').delete().like('notes', `${marker}%`)).error);
  await removeSecondaryGuardianRelationships();
  const studentEmail = traceabilityEmail('student');
  const { data: studentProfile, error: studentProfileError } = await db.from('profiles')
    .select('id').eq('email', studentEmail).maybeSingle();
  await assertNoError('No se pudo resolver el estudiante secundario de trazabilidad', studentProfileError);
  if (studentProfile) {
    await assertNoError('No se pudo limpiar el vínculo del estudiante secundario de trazabilidad',
      (await db.from('student_profiles').delete()
        .eq('profile_id', studentProfile.id).eq('student_id', students.outside)).error);
  }
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
  await assertNoError('No se pudieron limpiar autorizaciones temporales de retiradores E2E',
    (await db.from('guardian_students').delete()
      .in('student_id', studentIds).eq('relation_type', 'RETIRADOR_AUTORIZADO')).error);

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

export async function ensureSecondaryGuardianProfile() {
  const { db, institutionId, students } = await resolveE2EData();
  const email = secondaryGuardianEmail();
  let user = await findAuthUser(db, email);

  if (!user) {
    const { data, error } = await db.auth.admin.createUser({
      email,
      password: SECONDARY_GUARDIAN_PASSWORD,
      email_confirm: true,
      user_metadata: { first_name: 'Apoderado Primario', last_name: 'Familia B E2E' },
      app_metadata: { validgate_e2e: true, e2e_namespace: getE2EConfig().namespace },
    });
    await assertNoError('No se pudo crear el apoderado secundario E2E', error);
    user = requireData('No se pudo crear el apoderado secundario E2E', data.user);
  }

  await assertNoError('No se pudo actualizar el acceso del apoderado secundario E2E',
    (await db.auth.admin.updateUserById(user.id, {
      password: SECONDARY_GUARDIAN_PASSWORD,
      email_confirm: true,
      user_metadata: { first_name: 'Apoderado Primario', last_name: 'Familia B E2E' },
    })).error);

  await assertNoError('No se pudo preparar el perfil del apoderado secundario E2E',
    (await db.from('profiles').upsert({
      id: user.id,
      institution_id: institutionId,
      first_name: 'Apoderado Primario',
      last_name: 'Familia B E2E',
      email,
      role: 'APODERADO',
    })).error);
  await assertNoError('No se pudo limpiar el vínculo secundario E2E anterior',
    (await db.from('guardian_students').delete()
      .eq('guardian_profile_id', user.id).in('student_id', [students.inside, students.outside])).error);

  return {
    guardianId: user.id,
    guardianName: 'Apoderado Primario Familia B E2E',
    guardianEmail: email,
  };
}

export async function addSecondaryGuardianRelationshipToInside() {
  const { db, students } = await resolveE2EData();
  const guardian = await ensureSecondaryGuardianProfile();
  const { data: relationship, error } = await db.from('guardian_students').insert({
    guardian_profile_id: guardian.guardianId,
    student_id: students.inside,
    relation_type: 'APODERADO',
  }).select('id').single();
  await assertNoError('No se pudo crear el vínculo secundario E2E', error);

  return {
    ...guardian,
    relationshipId: Number(requireData('No se pudo crear el vínculo secundario E2E', relationship).id),
  };
}

export async function removeSecondaryGuardianRelationships() {
  const { db, students } = await resolveE2EData();
  const { data: profile, error } = await db.from('profiles').select('id').eq('email', secondaryGuardianEmail()).maybeSingle();
  await assertNoError('No se pudo resolver el apoderado secundario E2E', error);
  if (!profile) return;
  await assertNoError('No se pudieron limpiar los vínculos secundarios E2E',
    (await db.from('guardian_students').delete()
      .eq('guardian_profile_id', profile.id).in('student_id', [students.inside, students.outside])).error);
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
