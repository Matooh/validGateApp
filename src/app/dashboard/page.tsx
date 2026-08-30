import Link from 'next/link';

import {
  confirmStudentSelfExitFromForm,
  createStudentExitAuthorizationRequestFromForm,
  listGuardianPendingAuthorizationRequests,
  respondToAuthorizationRequestFromForm,
} from '@/app/actions/authorization-requests';
import {
  cancelGuardianPickupRequestFromForm,
  createGuardianPickupRequestFromForm,
  listGuardianPickupRequests,
  listMyPickupPins,
  respondGuardianPickupRequestFromForm,
} from '@/app/actions/guardian-pickups';
import { unlinkStudentAction } from '@/app/actions/students';
import { AppNav } from '@/components/app-nav';
import { DashboardAutoRefresh } from '@/components/dashboard-auto-refresh';
import { FeedbackToast } from '@/components/feedback-toast';
import { PendingSubmitButton } from '@/components/pending-submit-button';
import { RecentEventCard } from '@/components/recent-event-card';
import { StatusBadge } from '@/components/status-badge';
import { requireUser } from '@/lib/auth';
import { getCurrentStudentForAuthenticatedUser } from '@/lib/students/get-current-student';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type InstitutionSummary = {
  name?: string | null;
};

type StudentGuardianLink = {
  student_id: number;
  student_name: string;
  institution_name: string;
  guardian_profile_id: string;
  guardian_name: string | null;
  guardian_email: string | null;
  relation_type: string | null;
  linked_at: string;
};

type ActiveQrCredential = {
  id: string;
  expires_at: string;
} | null;

function getDashboardCopy(role?: string | null, firstName?: string | null, email?: string | null) {
  const name = firstName || email || 'usuario';

  if (role === 'ADMIN') {
    return {
      eyebrow: 'Administración',
      title: `Hola, ${name}.`,
      description:
        'Administra la configuración institucional, revisa la trazabilidad operacional y supervisa los métodos de validación disponibles.',
      primaryTitle: 'Gestión institucional',
      primaryDescription: 'Accesos rápidos para configuración, portería y seguridad.',
      recentDescription: 'Últimos eventos registrados en la institución.',
    };
  }

  if (role === 'PORTERIA') {
    return {
      eyebrow: 'Portería',
      title: `Hola, ${name}.`,
      description:
        'Valida credenciales, registra ingresos y salidas, y revisa eventos recientes del establecimiento.',
      primaryTitle: 'Operación de portería',
      primaryDescription: 'Herramientas para control de ingreso, salida y retiro.',
      recentDescription: 'Últimos eventos registrados por portería.',
    };
  }

  if (role === 'DOCENTE') {
    return {
      eyebrow: 'Docencia',
      title: `Hola, ${name}.`,
      description:
        'Consulta estudiantes, cursos, asistencia y la trazabilidad académica disponible en tu institución.',
      primaryTitle: 'Actividad académica',
      primaryDescription: 'Información institucional relevante para la labor docente.',
      recentDescription: 'Últimos eventos de los estudiantes de tu institución.',
    };
  }

  if (role === 'APODERADO') {
    return {
      eyebrow: 'Apoderado Primario',
      title: `Hola, ${name}.`,
      description:
        'Consulta estudiantes vinculados, revisa su trazabilidad y gestiona credenciales o autorizaciones cuando corresponda.',
      primaryTitle: 'Estudiantes vinculados',
      primaryDescription: 'Información de estudiantes asociados a tu cuenta.',
      recentDescription: 'Eventos más recientes de tus estudiantes vinculados.',
    };
  }

  if (role === 'RETIRADOR_AUTORIZADO') {
    return {
      eyebrow: 'Apoderado Secundario',
      title: `Hola, ${name}.`,
      description: 'Consulta tus autorizaciones temporales vigentes e inicia un retiro cuando corresponda.',
      primaryTitle: 'Estudiantes autorizados',
      primaryDescription: 'Solo se muestran estudiantes con una autorización vigente.',
      recentDescription: 'Eventos recientes de los estudiantes que puedes retirar.',
    };
  }

  if (role === 'ESTUDIANTE') {
    return {
      eyebrow: 'Estudiante',
      title: `Hola, ${name}.`,
      description:
        'Consulta tus métodos de autenticación, revisa tus responsables vinculados y presenta credenciales para portería.',
      primaryTitle: 'Apoderados vinculados',
      primaryDescription: 'Información sobre apoderados primarios y secundarios vinculados.',
      recentDescription: 'Últimos eventos registrados para tu perfil.',
    };
  }

  return {
    eyebrow: 'Perfil',
    title: `Hola, ${name}.`,
    description: 'Consulta la información y las opciones disponibles para tu cuenta.',
    primaryTitle: 'Resumen de cuenta',
    primaryDescription: 'Información asociada a tu perfil.',
    recentDescription: 'Últimos eventos disponibles para tu cuenta.',
  };
}

function getRoleActionItems(role?: string | null) {
  if (role === 'ADMIN') {
    return [
      { href: '/guard', label: 'Módulo portería', className: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100' },
      { href: '/settings', label: 'Políticas de acceso', className: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100' },
      { href: '/authentications', label: 'QR dinámico OK', className: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100' },
    ];
  }

  if (role === 'PORTERIA') {
    return [
      { href: '/guard', label: 'Registrar evento', className: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100' },
      { href: '/guard', label: 'Validar QR', className: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100' },
      { href: '/authentications', label: 'QR dinámico OK', className: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100' },
    ];
  }

  if (role === 'RETIRADOR_AUTORIZADO') {
    return [
      { href: '/links', label: 'Autorizaciones vigentes', className: 'border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100' },
      { href: '/dashboard', label: 'Retiro con PIN dual', className: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100' },
    ];
  }

  return [
    { href: '/authentications', label: 'QR dinámico OK', className: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100' },
    { href: '/authentications', label: 'PIN dual disponible', className: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100' },
  ];
}

function getInstitutionName(institutions: unknown) {
  const institution = Array.isArray(institutions) ? institutions[0] : institutions;

  if (!institution || typeof institution !== 'object' || !('name' in institution)) {
    return null;
  }

  const name = (institution as InstitutionSummary).name;
  return typeof name === 'string' ? name.trim() : null;
}

function getGuardianRelationDisplay(relationType?: string | null) {
  if (relationType === 'RETIRADOR_AUTORIZADO') {
    return {
      label: 'Apoderado Secundario',
      badge: 'Apoderado Secundario',
      className: 'bg-slate-100 text-slate-700',
    };
  }

  return {
    label: 'Apoderado Primario',
    badge: 'Apoderado Primario',
    className: 'bg-sky-100 text-sky-700',
  };
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; toast?: string; kind?: string }>;
}) {
  const { user, profile } = await requireUser();
  const supabase = await createClient();
  const params = await searchParams;
  const toastMessage =
    params.toast === 'LOGIN_SUCCESS' ? 'Ingreso exitoso.' : params.message ?? null;
  const toastTone = params.toast === 'LOGIN_SUCCESS'
    ? 'success'
    : params.kind === 'error'
      ? 'danger'
    : toastMessage
      ? /no se pudo|no tienes|no est[aá] autorizado|debes|rechaz|no encontramos|no hay|invalid|forbidden/i.test(toastMessage)
        ? 'danger'
        : /atencion|advert|existe|pendiente/i.test(toastMessage)
          ? 'warning'
          : 'success'
      : 'info';
  const currentStudent =
    profile?.role === 'ESTUDIANTE'
      ? await getCurrentStudentForAuthenticatedUser()
      : null;

  const { data: linkedStudents } = await supabase
    .from('guardian_students')
    .select('id, relation_type, students(id, first_name, last_name, is_in_institution, can_leave_alone, link_code, institution_id, institutions(id, name))')
    .eq('guardian_profile_id', user.id)
    .order('id', { ascending: true });

  let staffInstitutionName: string | null = null;
  if (profile?.institution_id) {
    const { data: institution } = await supabase
      .from('institutions')
      .select('name')
      .eq('id', profile.institution_id)
      .maybeSingle();

    staffInstitutionName = institution?.name ?? null;
  }

  const linkedStudentIds = (linkedStudents ?? [])
    .map((item) => {
      const student = Array.isArray(item.students) ? item.students[0] : item.students;
      return student?.id;
    })
    .filter((value): value is number => typeof value === 'number');

  const linkedInstitutionNames = Array.from(
    new Set(
      (linkedStudents ?? [])
        .map((item) => {
          const student = Array.isArray(item.students) ? item.students[0] : item.students;
          return getInstitutionName(student?.institutions);
        })
        .filter((value): value is string => Boolean(value))
    )
  );

  const institutionNames = ['APODERADO', 'RETIRADOR_AUTORIZADO'].includes(profile?.role ?? '')
    ? linkedInstitutionNames
    : staffInstitutionName
      ? [staffInstitutionName]
      : [];

  const { data: studentGuardianLinks } =
    currentStudent
      ? await supabase.rpc('get_student_guardian_links', {
          p_student_ids: [currentStudent.studentId],
        })
      : { data: [] };

  const { data: activeQrCredential } =
    currentStudent
      ? await supabase
          .from('student_qr_credentials')
          .select('id, expires_at')
          .eq('student_id', currentStudent.studentId)
          .eq('institution_id', currentStudent.institutionId)
          .eq('created_by', user.id)
          .is('used_at', null)
          .is('revoked_at', null)
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      : { data: null };

  const { data: pendingStudentAuthorizationRequest } =
    currentStudent
      ? await supabase
          .from('authorization_requests')
          .select('id, requested_at, expires_at, reason')
          .eq('student_id', currentStudent.studentId)
          .eq('requested_by_profile_id', user.id)
          .eq('status', 'PENDING')
          .gt('expires_at', new Date().toISOString())
          .order('requested_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      : { data: null };

  const guardianLinks = (studentGuardianLinks ?? []) as StudentGuardianLink[];
  const studentActiveQrCredential = activeQrCredential as ActiveQrCredential;
  const studentHasActiveQr = Boolean(studentActiveQrCredential);
  const studentHasPendingAuthorizationRequest = Boolean(pendingStudentAuthorizationRequest);
  const pendingAuthorizationRequests =
    profile?.role === 'APODERADO'
      ? await listGuardianPendingAuthorizationRequests()
      : [];
  const pickupRequests = ['APODERADO', 'RETIRADOR_AUTORIZADO', 'ESTUDIANTE'].includes(profile?.role ?? '')
    ? await listGuardianPickupRequests()
    : [];
  const activePickupRequests = pickupRequests.filter((request) =>
    ['PENDING_STUDENT_RESPONSE', 'PENDING_GUARD_VALIDATION', 'BOTH_VALIDATED'].includes(request.status),
  );
  const pickupPins = await listMyPickupPins(
    activePickupRequests
      .filter((request) => request.status !== 'PENDING_STUDENT_RESPONSE')
      .map((request) => request.requestId),
  );
  const pickupPinByRequestId = new Map(pickupPins.map((pin) => [pin.requestId, pin]));
  const activePickupByStudentId = new Map(activePickupRequests.map((request) => [request.studentId, request]));

  let accessEventsQuery = supabase
    .from('access_events')
    .select('id, event_type, exit_kind, validation_kind, result, occurred_at, notes, policy_snapshot, students(id, first_name, last_name)')
    .order('occurred_at', { ascending: false })
    .limit(8);

  if (['APODERADO', 'RETIRADOR_AUTORIZADO'].includes(profile?.role ?? '')) {
    accessEventsQuery = linkedStudentIds.length > 0
      ? accessEventsQuery.in('student_id', linkedStudentIds)
      : accessEventsQuery.eq('student_id', -1);
  }

  if (profile?.role === 'ESTUDIANTE') {
    accessEventsQuery = currentStudent
      ? accessEventsQuery.eq('student_id', currentStudent.studentId)
      : accessEventsQuery.eq('student_id', -1);
  }

  const { data: accessEvents } = await accessEventsQuery;
  // Also include recent authorization requests/updates for traceability
  let recentAuthRequests: any[] = [];
  if (
    profile?.role === 'ADMIN' ||
    profile?.role === 'PORTERIA' ||
    profile?.role === 'APODERADO' ||
    profile?.role === 'ESTUDIANTE'
  ) {
    const { data: authData } = await supabase
      .from('authorization_requests')
      .select('id, status, request_type, requested_at, responded_at, expires_at, reason, guardian_profile_id, students(id, first_name, last_name)')
      .or('status.eq.PENDING,status.eq.APPROVED,status.eq.REJECTED')
      .order('requested_at', { ascending: false })
      .limit(8);

    recentAuthRequests = (authData ?? []).map((ar: any) => {
      const isPending =
        ar.status === 'PENDING' &&
        new Date(ar.expires_at ?? ar.requested_at).getTime() > Date.now();
      const requestLabel =
        isPending
          ? 'Solicitud de retiro en curso'
          : ar.status === 'APPROVED'
            ? 'Solicitud de retiro aprobada'
            : ar.status === 'REJECTED'
              ? 'Solicitud de retiro rechazada'
              : 'Solicitud de retiro expirada';

      return {
        id: ar.id,
        event_type: requestLabel,
        exit_kind: ['EXIT_ALONE', 'EXIT_CONTINGENCY'].includes(ar.request_type) ? 'SOLO' : 'RETIRO_AUTORIZADO',
        validation_kind: 'SOLICITUD',
        result: ar.status,
        occurred_at: ar.responded_at ?? ar.requested_at,
        notes: ar.reason ?? (isPending ? 'Esperando respuesta del Apoderado Primario.' : requestLabel),
        students: ar.students,
        isAuthRequest: true,
        isPendingAuthorizationRequest: isPending,
        requestLabel,
      };
    });
  }

  const combinedEvents = [
    ...((accessEvents ?? []) as any[]),
    ...recentAuthRequests,
    ...pickupRequests.slice(0, 8).map((request) => ({
      id: `pickup-${request.requestId}`,
      event_type: 'Solicitud de retiro con PIN dual',
      exit_kind: 'RETIRO_AUTORIZADO',
      validation_kind: 'PIN DUAL',
      result: request.status,
      occurred_at: request.updatedAt,
      notes: request.status === 'PENDING_STUDENT_RESPONSE'
        ? 'Esperando respuesta del estudiante.'
        : request.status === 'PENDING_GUARD_VALIDATION'
          ? 'Pendiente de validación presencial en portería.'
          : request.status === 'BOTH_VALIDATED'
            ? 'Ambas personas validadas; completando el retiro automáticamente.'
            : request.status === 'REJECTED_BY_STUDENT'
              ? 'Solicitud de retiro rechazada por el estudiante.'
            : `Estado final: ${request.status}`,
      students: { id: request.studentId, first_name: request.studentName, last_name: '' },
      isAuthRequest: true,
      isPendingAuthorizationRequest: ['PENDING_STUDENT_RESPONSE', 'PENDING_GUARD_VALIDATION', 'BOTH_VALIDATED'].includes(request.status),
      requestLabel: 'Retiro con PIN dual',
    })),
  ]
    .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
    .slice(0, 8);

  const displayName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || profile?.email || null;
  const recentEventStorageScope = `dashboard:${profile?.role ?? 'SIN_ROL'}:${user.id}`;
  const institutionLabel = institutionNames.length > 1 ? 'Instituciones' : 'Institución';
  const institutionEmptyText = ['APODERADO', 'RETIRADOR_AUTORIZADO'].includes(profile?.role ?? '') ? 'Sin instituciones vinculadas' : 'No asignada';
  const dashboardCopy = getDashboardCopy(profile?.role, profile?.first_name, profile?.email);
  const roleActionItems = getRoleActionItems(profile?.role);
  const autoRefreshExpiresAt = [
    pendingStudentAuthorizationRequest?.expires_at,
    ...pendingAuthorizationRequests.map((request) => request.expiresAt),
    ...activePickupRequests.map((request) => request.expiresAt),
  ];

  return (
    <main className="min-h-screen bg-slate-50">
      <DashboardAutoRefresh expiresAt={autoRefreshExpiresAt} />
      <FeedbackToast message={toastMessage} tone={toastTone} title="Dashboard" />
      <AppNav role={profile?.role} displayName={displayName} />

      <section className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <div className="grid gap-4 rounded-2xl bg-slate-900 p-4 text-white shadow-lg sm:p-6 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] md:rounded-3xl">
          <div className="min-w-0">
            <p data-testid="dashboard-role-eyebrow" className="text-xs uppercase tracking-[0.2em] text-sky-200 sm:text-sm sm:tracking-[0.25em]">{dashboardCopy.eyebrow}</p>
            <h1 className="mt-2 break-words text-2xl font-bold sm:text-3xl">{dashboardCopy.title}</h1>
            <p className="mt-2 max-w-2xl text-slate-300">
              {dashboardCopy.description}
            </p>
          </div>
          <div className="grid min-w-0 gap-3 rounded-2xl bg-white/10 p-4 text-sm">
            <div className="min-w-0">
              <p className="text-slate-300">Rol</p>
              <p className="break-words text-lg font-semibold">{profile?.role ?? 'SIN ROL'}</p>
            </div>
            <div className="min-w-0">
              <p className="text-slate-300">{institutionLabel}</p>
              {institutionNames.length <= 1 ? (
                <p className="break-words text-lg font-semibold">{institutionNames[0] ?? institutionEmptyText}</p>
              ) : (
                <div className="mt-2 flex flex-wrap gap-2">
                  {institutionNames.map((institutionName) => (
                    <span key={institutionName} className="max-w-full break-words rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-white ring-1 ring-white/20">
                      {institutionName}
                    </span>
                  ))}
                </div>
              )}
              {profile?.role === 'APODERADO' && institutionNames.length > 1 ? (
                <p className="mt-2 text-xs text-slate-300">Tienes estudiantes vinculados en múltiples instituciones.</p>
              ) : null}
            </div>
          </div>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 md:rounded-3xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <h2 className="text-xl font-semibold text-slate-900">
                {profile?.role === 'ADMIN'
                  ? 'Administración y seguridad'
                  : profile?.role === 'PORTERIA'
                    ? 'Acciones de portería'
                    : 'Métodos de autenticación'}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {profile?.role === 'ADMIN'
                  ? 'Gestiona configuración, seguridad y control operacional.'
                  : profile?.role === 'PORTERIA'
                    ? 'Accesos directos para validar y registrar eventos.'
                    : 'Estado operativo de los mecanismos disponibles para validar eventos en portería.'}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {roleActionItems.map((item) => (
                <Link
                  key={`${item.href}-${item.label}`}
                  href={item.href}
                  className={`rounded-xl border px-4 py-3 text-sm font-semibold ${item.className}`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </section>

        {profile?.role === 'ESTUDIANTE' && activePickupRequests.length > 0 ? (
          <section className="min-w-0 space-y-4 rounded-2xl border border-amber-200 bg-white p-4 shadow-sm sm:p-6 md:rounded-3xl">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Solicitudes de retiro pendientes</h2>
              <p className="mt-1 text-sm text-slate-500">Confirma la recepción y dirígete a portería. Tu respuesta no registra la salida.</p>
            </div>
            {activePickupRequests.map((request) => {
              const pin = pickupPinByRequestId.get(request.requestId);
              return (
                <article key={request.requestId} className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4">
                  <p className="font-semibold text-slate-900">{request.guardianName}</p>
                  <p className="mt-2 rounded-xl bg-white px-3 py-2 text-sm text-slate-700">{request.notificationMessage}</p>
                  {request.status === 'PENDING_STUDENT_RESPONSE' ? (
                    <form action={respondGuardianPickupRequestFromForm} className="mt-4 flex flex-col gap-2 sm:flex-row">
                      <input type="hidden" name="request_id" value={request.requestId} />
                      <PendingSubmitButton name="decision" value="ACCEPT" pendingLabel="Aceptando..." className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800">
                        Aceptar
                      </PendingSubmitButton>
                      <PendingSubmitButton name="decision" value="REJECT" pendingLabel="Rechazando..." className="rounded-xl border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50">
                        Rechazar
                      </PendingSubmitButton>
                    </form>
                  ) : pin ? (
                    <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-center">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">Tu PIN de estudiante</p>
                      <p className="mt-2 font-mono text-3xl font-bold tracking-[0.35em] text-slate-900">{pin.pin}</p>
                      <p className="mt-2 text-xs text-slate-500">Válido hasta {new Date(pin.expiresAt).toLocaleTimeString('es-CL')}. Muéstralo solo a portería.</p>
                    </div>
                  ) : (
                    <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Tu identidad ya fue validada. Espera la confirmación de portería.</p>
                  )}
                </article>
              );
            })}
          </section>
        ) : null}

        {['APODERADO', 'RETIRADOR_AUTORIZADO'].includes(profile?.role ?? '') && activePickupRequests.length > 0 ? (
          <section className="min-w-0 space-y-4 rounded-2xl border border-sky-200 bg-white p-4 shadow-sm sm:p-6 md:rounded-3xl">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Retiros en curso</h2>
              <p className="mt-1 text-sm text-slate-500">Presenta tu PIN en portería cuando el estudiante haya aceptado.</p>
            </div>
            {activePickupRequests.map((request) => {
              const pin = pickupPinByRequestId.get(request.requestId);
              return (
                <article key={request.requestId} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{request.studentName}</p>
                      <p className="mt-1 text-sm text-slate-500">{request.status === 'PENDING_STUDENT_RESPONSE' ? 'Esperando respuesta del estudiante' : request.status === 'BOTH_VALIDATED' ? 'Ambos validados; completando retiro' : 'Pendiente de validación en portería'}</p>
                    </div>
                    <form action={cancelGuardianPickupRequestFromForm}>
                      <input type="hidden" name="request_id" value={request.requestId} />
                      <PendingSubmitButton pendingLabel="Cancelando..." className="rounded-xl border border-rose-300 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50">Cancelar</PendingSubmitButton>
                    </form>
                  </div>
                  {pin ? (
                    <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-center">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">
                        Tu PIN de {profile?.role === 'RETIRADOR_AUTORIZADO' ? 'Apoderado Secundario' : 'Apoderado Primario'}
                      </p>
                      <p className="mt-2 font-mono text-3xl font-bold tracking-[0.35em] text-slate-900">{pin.pin}</p>
                      <p className="mt-2 text-xs text-slate-500">Válido hasta {new Date(pin.expiresAt).toLocaleTimeString('es-CL')}. No lo compartas con el estudiante.</p>
                    </div>
                  ) : request.status !== 'PENDING_STUDENT_RESPONSE' ? (
                    <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Tu identidad ya fue validada.</p>
                  ) : null}
                </article>
              );
            })}
          </section>
        ) : null}

        {profile?.role === 'ESTUDIANTE' && currentStudent ? (
          <section className="min-w-0 space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 md:rounded-3xl">
            <div className="min-w-0">
              <h2 className="text-xl font-semibold text-slate-900">Status</h2>
              <p className="text-sm text-slate-500">
                Estado actual y acciones de salida disponibles para el estudiante.
              </p>
            </div>

            {currentStudent.canLeaveAlone ? (
              <form
                action={confirmStudentSelfExitFromForm}
                className="rounded-2xl border border-slate-200 p-4 sm:p-5"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-lg font-semibold text-slate-900">
                      Salida por voluntad del estudiante
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Registra tu salida directa con una credencial QR vigente.
                    </p>
                    <p className="mt-2 text-sm text-slate-500">
                      Estado actual:{' '}
                      <span className="font-medium text-slate-800">
                        {currentStudent.isInInstitution ? 'Dentro de la institución' : 'Fuera de la institución'}
                      </span>
                    </p>
                    <p
                      className={`mt-2 text-sm font-medium ${
                        studentHasActiveQr ? 'text-emerald-700' : 'text-amber-700'
                      }`}
                    >
                      Estado QR:{' '}
                      {studentActiveQrCredential
                        ? `Vigente hasta ${new Date(studentActiveQrCredential.expires_at).toLocaleTimeString('es-CL', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}`
                        : 'No hay una credencial QR vigente generada.'}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row lg:shrink-0">
                    <Link
                      href="/authentications"
                      className="rounded-xl border border-slate-300 px-4 py-3 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      {studentHasActiveQr ? 'Ver QR' : 'Generar QR'}
                    </Link>
                    <PendingSubmitButton
                      disabled={!currentStudent.isInInstitution || !studentHasActiveQr}
                      pendingLabel="Registrando..."
                      className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                    >
                      Registrar salida
                    </PendingSubmitButton>
                  </div>
                </div>
              </form>
            ) : (
              <form
                action={createStudentExitAuthorizationRequestFromForm}
                className="rounded-2xl border border-slate-200 p-4 sm:p-5"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-lg font-semibold text-slate-900">
                      Solicitud de autorización de salida
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Pide autorización a tu Apoderado Primario. Si acepta, ambos deberán presentar sus PIN en portería
                      antes de que se registre el retiro.
                    </p>
                    <p className="mt-2 text-sm text-slate-500">
                      Estado actual:{' '}
                      <span className="font-medium text-slate-800">
                        {currentStudent.isInInstitution ? 'Dentro de la institución' : 'Fuera de la institución'}
                      </span>
                    </p>
                  </div>
                  <PendingSubmitButton
                    disabled={!currentStudent.isInInstitution || studentHasPendingAuthorizationRequest}
                    pendingLabel="Enviando..."
                    className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                  >
                    {studentHasPendingAuthorizationRequest
                      ? 'Solicitud en curso'
                      : 'Solicitar autorización de salida'}
                  </PendingSubmitButton>
                </div>
                {studentHasPendingAuthorizationRequest ? (
                  <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    Ya existe una solicitud de retiro vigente. Espera la respuesta de tu Apoderado Primario antes de crear una nueva.
                  </p>
                ) : null}
                <label htmlFor="exit_reason" className="mt-4 block text-sm font-medium text-slate-700">
                  Motivo opcional
                </label>
                <textarea
                  id="exit_reason"
                  name="reason"
                  rows={2}
                  disabled={studentHasPendingAuthorizationRequest}
                  placeholder="Ej: salida por trámite familiar"
                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                />
              </form>
            )}
          </section>
        ) : null}

        <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <section className="min-w-0 space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 md:rounded-3xl">
            <div className="min-w-0">
              <div className="min-w-0">
                <h2 className="text-xl font-semibold text-slate-900">{dashboardCopy.primaryTitle}</h2>
                <p className="text-sm text-slate-500">{dashboardCopy.primaryDescription}</p>
              </div>
            </div>

            <div className="space-y-4">
              {profile?.role === 'ADMIN' || profile?.role === 'PORTERIA' ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Link href="/guard" className="rounded-2xl border border-slate-200 p-4 hover:bg-slate-50">
                    <p className="font-semibold text-slate-900">Portería</p>
                    <p className="mt-1 text-sm text-slate-500">Validar QR y registrar ingresos, salidas o retiros.</p>
                  </Link>
                  <Link href="/settings" className="rounded-2xl border border-slate-200 p-4 hover:bg-slate-50">
                    <p className="font-semibold text-slate-900">
                      {profile?.role === 'ADMIN' ? 'Configuración' : 'Perfil'}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {profile?.role === 'ADMIN'
                        ? 'Actualizar políticas institucionales y datos de seguridad.'
                        : 'Actualizar datos de usuario y seguridad personal.'}
                    </p>
                  </Link>
                </div>
              ) : profile?.role === 'ESTUDIANTE' ? (
                <div className="space-y-4">
                  {guardianLinks.length > 0 ? (
                    guardianLinks.map((link) => (
                      (() => {
                        const relation = getGuardianRelationDisplay(link.relation_type);

                        return (
                          <article
                            key={`${link.student_id}-${link.guardian_profile_id}`}
                            className="min-w-0 rounded-2xl border border-slate-200 p-4 sm:p-5"
                          >
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0 flex-1">
                                <h3 className="break-words text-lg font-semibold text-slate-900">
                                  {link.guardian_name || 'Responsable sin nombre'}
                                </h3>
                                <p className="mt-1 break-words text-sm text-slate-500">
                                  Relación: {relation.label}
                                </p>
                                <p className="mt-1 break-words text-sm text-slate-500">
                                  Email: {link.guardian_email ?? 'Sin correo registrado'}
                                </p>
                                <p className="mt-1 break-words text-sm text-slate-500">
                                  Institución: {link.institution_name}
                                </p>
                              </div>
                              <span className={`w-fit max-w-full break-words rounded-full px-3 py-1 text-sm font-medium sm:shrink-0 ${relation.className}`}>
                                {relation.badge}
                              </span>
                            </div>
                          </article>
                        );
                      })()
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
                      No hay apoderados primarios o secundarios vinculados para mostrar.
                    </div>
                  )}
                </div>
              ) : linkedStudents && linkedStudents.length > 0 ? (
                linkedStudents.map((item) => {
                  const student = Array.isArray(item.students) ? item.students[0] : item.students;
                  if (!student) return null;
                  const institutionName = getInstitutionName(student.institutions);
                  const activePickup = activePickupByStudentId.get(student.id);

                  return (
                    <article key={item.id} className="min-w-0 rounded-2xl border border-slate-200 p-4 sm:p-5">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <h3 className="break-words text-lg font-semibold text-slate-900">
                            {student.first_name} {student.last_name}
                          </h3>
                          <p className="mt-1 break-words text-sm text-slate-500">Relación: {getGuardianRelationDisplay(item.relation_type).label}</p>
                          <p className="mt-1 break-words text-sm text-slate-500">
                            Institución: {institutionName ?? 'Sin institución'}
                          </p>
                          {profile?.role === 'APODERADO' ? <p className="mt-1 break-words text-sm text-slate-500">Código de vinculación: {student.link_code}</p> : null}
                        </div>
                        <span
                          className={`w-fit max-w-full break-words rounded-full px-3 py-1 text-sm font-medium sm:shrink-0 ${
                            student.is_in_institution ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {student.is_in_institution ? 'En institución' : 'Fuera de institución'}
                        </span>
                      </div>

                      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                        {profile?.role === 'APODERADO' ? <Link href={`/students/${student.id}`} className="rounded-xl border border-slate-300 px-4 py-2 text-center text-sm font-medium text-slate-700 hover:bg-slate-50">Ver detalle</Link> : null}
                        {student.is_in_institution ? (
                          <form action={createGuardianPickupRequestFromForm} className="sm:w-auto">
                            <input type="hidden" name="student_id" value={student.id} />
                            <PendingSubmitButton
                              disabled={Boolean(activePickup)}
                              pendingLabel="Notificando..."
                              className="w-full rounded-xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-sky-300 sm:w-auto"
                            >
                              {activePickup ? 'Retiro en curso' : 'Notificar retiro'}
                            </PendingSubmitButton>
                          </form>
                        ) : null}
                        {profile?.role === 'APODERADO' ? (
                          <form action={unlinkStudentAction} className="sm:w-auto">
                            <input type="hidden" name="relation_id" value={item.id} />
                            <PendingSubmitButton pendingLabel="Desvinculando..." className="w-full rounded-xl border border-rose-300 px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:bg-rose-50 disabled:text-rose-300 sm:w-auto">Desvincular</PendingSubmitButton>
                          </form>
                        ) : null}
                      </div>
                    </article>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
                  {['APODERADO', 'RETIRADOR_AUTORIZADO'].includes(profile?.role ?? '')
                    ? 'No tienes estudiantes vinculados para mostrar.'
                    : 'No hay apoderados primarios o secundarios vinculados para mostrar.'}
                </div>
              )}
            </div>
          </section>

          <section className="min-w-0 space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 md:rounded-3xl">
            {profile?.role === 'APODERADO' ? (
              <div className="space-y-4 border-b border-slate-200 pb-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">Solicitudes pendientes</h2>
                    <p className="text-sm text-slate-500">
                      Responde solicitudes de salida antes de que expiren.
                    </p>
                  </div>
                  <Link href="/dashboard" className="text-sm font-medium text-sky-700 hover:underline">
                    Refrescar
                  </Link>
                </div>

                {pendingAuthorizationRequests.length > 0 ? (
                  <div className="space-y-3">
                    {pendingAuthorizationRequests.map((request) => (
                      <article key={request.id} className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4">
                        <p className="font-semibold text-slate-900">{request.studentName}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          Curso: {request.courseName ?? 'Sin curso asignado'}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          Estado: {request.isInInstitution ? 'Dentro de la institución' : 'Fuera de la institución'}
                        </p>
                        {request.requestType === 'EXIT_CONTINGENCY' ? (
                          <p className="mt-2 text-sm font-medium text-amber-800">
                            Salida manual por contingencia solicitada desde Portería.
                          </p>
                        ) : null}
                        {request.requestType === 'EXIT_ALONE' && !request.canLeaveAlone ? (
                          <p className="mt-3 rounded-xl border border-amber-300 bg-amber-100 px-3 py-2 text-sm font-medium text-amber-950">
                            Este estudiante no tiene permiso para salir solo. La salida directa no puede aprobarse;
                            debes iniciar un retiro con PIN dual y completar la validación presencial en portería.
                          </p>
                        ) : null}
                        {request.reason ? (
                          <p className="mt-2 rounded-xl bg-white px-3 py-2 text-sm text-slate-700">
                            <span className="font-medium">Motivo:</span> {request.reason}
                          </p>
                        ) : null}
                        <p className="mt-2 text-xs text-slate-500">
                          Solicitada: {new Date(request.requestedAt).toLocaleString('es-CL')} · Expira:{' '}
                          {new Date(request.expiresAt).toLocaleTimeString('es-CL', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                        <form action={respondToAuthorizationRequestFromForm} className="mt-3 flex flex-col gap-2 sm:flex-row">
                          <input type="hidden" name="request_id" value={request.id} />
                          {request.requestType === 'EXIT_ALONE' && !request.canLeaveAlone ? (
                            <PendingSubmitButton
                              name="decision"
                              value="SUPERVISED_PICKUP"
                              pendingLabel="Iniciando retiro..."
                              className="rounded-xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-sky-300"
                            >
                              Iniciar retiro con PIN dual
                            </PendingSubmitButton>
                          ) : (
                            <PendingSubmitButton
                              name="decision"
                              value="APPROVED"
                              pendingLabel="Procesando..."
                              className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-emerald-300"
                            >
                              Aprobar
                            </PendingSubmitButton>
                          )}
                          <PendingSubmitButton
                            name="decision"
                            value="REJECTED"
                            pendingLabel="Procesando..."
                            className="rounded-xl border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:border-rose-100 disabled:text-rose-300"
                          >
                            Rechazar
                          </PendingSubmitButton>
                        </form>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
                    No hay solicitudes pendientes.
                  </p>
                )}
              </div>
            ) : null}

            <div className="min-w-0">
              <h2 className="text-xl font-semibold text-slate-900">Trazabilidad reciente</h2>
              <p className="text-sm text-slate-500">
                {profile?.role === 'APODERADO'
                  ? 'Eventos más recientes de tus estudiantes vinculados.'
                  : dashboardCopy.recentDescription}
              </p>
            </div>
            <div className="space-y-3">
              {combinedEvents.length > 0 ? (
                combinedEvents.map((event) => {
                  const student = Array.isArray(event.students) ? event.students[0] : event.students;
                  // TODO: reemplazar por una condición real cuando exista un estado
                  // de evento nuevo/no leído o de visualización por usuario.
                  const shouldShowNewBadge = true;

                  return (
                    <RecentEventCard
                      key={event.id}
                      eventId={String(event.id)}
                      storageScope={`${recentEventStorageScope}:${event.isAuthRequest ? 'auth' : 'access'}`}
                      showNewBadge={shouldShowNewBadge}
                    >
                      <p className="break-words font-medium text-slate-900">
                        {student ? `${student.first_name} ${student.last_name}` : 'Estudiante'}
                      </p>
                      {event.isAuthRequest ? (
                        <p className="mt-1 break-words text-sm text-slate-500">{event.requestLabel}</p>
                      ) : null}
                      <div className="mt-2 flex flex-wrap gap-2">
                        <StatusBadge
                          value={
                            event.isAuthRequest || event.exit_kind === 'RETIRO_AUTORIZADO'
                              ? 'RETIRO'
                              : event.exit_kind === 'EXCEPCIONAL'
                                ? 'EXCEPCIONAL'
                                : event.event_type
                          }
                        />
                        <StatusBadge value={event.result} />
                        {!event.isAuthRequest && event.validation_kind === 'MANUAL' ? <StatusBadge value="MANUAL" /> : null}
                      </div>
                      {event.notes ? (
                        <div className="mt-3 break-words rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                          <span className="font-medium text-slate-900">Descripción:</span> {event.notes}
                        </div>
                      ) : null}
                      {!event.isAuthRequest && event.exit_kind === 'RETIRO_AUTORIZADO' && event.policy_snapshot?.guardian_name ? (
                        <p className="mt-2 break-words text-sm text-slate-600">
                          <span className="font-medium text-slate-900">Retirado por:</span>{' '}
                          {event.policy_snapshot.guardian_name}
                        </p>
                      ) : null}
                      <p className="mt-2 break-words text-xs text-slate-400">{new Date(event.occurred_at).toLocaleString('es-CL')}</p>
                    </RecentEventCard>
                  );
                })
              ) : (
                <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">Aún no hay eventos registrados.</p>
              )}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
