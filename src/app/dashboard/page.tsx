import Link from 'next/link';

import {
  confirmStudentSelfExitFromForm,
  createStudentExitAuthorizationRequestFromForm,
  listGuardianPendingAuthorizationRequests,
  respondToAuthorizationRequestFromForm,
} from '@/app/actions/authorization-requests';
import { unlinkStudentAction } from '@/app/actions/students';
import { AppNav } from '@/components/app-nav';
import { DashboardAutoRefresh } from '@/components/dashboard-auto-refresh';
import { FeedbackToast } from '@/components/feedback-toast';
import { PendingSubmitButton } from '@/components/pending-submit-button';
import { RecentEventCard } from '@/components/recent-event-card';
import { requireUser } from '@/lib/auth';
import { getCurrentStudentForAuthenticatedUser } from '@/lib/students/get-current-student';
import { createClient } from '@/lib/supabase/server';

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

  if (role === 'APODERADO') {
    return {
      eyebrow: 'Apoderado',
      title: `Hola, ${name}.`,
      description:
        'Consulta estudiantes vinculados, revisa su trazabilidad y gestiona credenciales o autorizaciones cuando corresponda.',
      primaryTitle: 'Estudiantes vinculados',
      primaryDescription: 'Información de estudiantes asociados a tu cuenta.',
      recentDescription: 'Eventos más recientes de tus estudiantes vinculados.',
    };
  }

  return {
    eyebrow: 'Estudiante',
    title: `Hola, ${name}.`,
    description:
      'Consulta tus métodos de autenticación, revisa tus responsables vinculados y presenta credenciales para portería.',
    primaryTitle: 'Apoderados',
    primaryDescription: 'Información sobre apoderados y personas responsables.',
    recentDescription: 'Últimos eventos registrados para tu perfil.',
  };
}

function getRoleActionItems(role?: string | null) {
  if (role === 'ADMIN') {
    return [
      { href: '/guard', label: 'Módulo portería', className: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100' },
      { href: '/settings', label: 'Políticas de acceso', className: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100' },
      { href: '/authentications', label: 'QR dinámico OK', className: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100' },
      { href: '/settings', label: 'MFA pendiente', className: 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100' },
    ];
  }

  if (role === 'PORTERIA') {
    return [
      { href: '/guard', label: 'Registrar evento', className: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100' },
      { href: '/guard', label: 'Validar QR', className: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100' },
      { href: '/authentications', label: 'QR dinámico OK', className: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100' },
      { href: '/settings', label: 'MFA pendiente', className: 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100' },
    ];
  }

  return [
    { href: '/authentications', label: 'QR dinámico OK', className: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100' },
    { href: '/authentications', label: 'PIN temporal pendiente', className: 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100' },
    { href: '/authentications', label: 'MFA pendiente', className: 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100' },
    { href: '/authentications', label: 'Biometría NOK', className: 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100' },
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
  if (relationType === 'APODERADO_PRINCIPAL') {
    return {
      label: 'Apoderado principal',
      badge: 'Apoderado principal',
      className: 'bg-emerald-100 text-emerald-700',
    };
  }

  if (relationType === 'RETIRADOR_AUTORIZADO') {
    return {
      label: 'Retirador autorizado',
      badge: 'Retirador autorizado',
      className: 'bg-slate-100 text-slate-700',
    };
  }

  return {
    label: 'Apoderado',
    badge: 'Apoderado',
    className: 'bg-sky-100 text-sky-700',
  };
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; toast?: string }>;
}) {
  const { user, profile } = await requireUser();
  const supabase = await createClient();
  const params = await searchParams;
  const toastMessage =
    params.toast === 'LOGIN_SUCCESS' ? 'Ingreso exitoso.' : params.message ?? null;
  const toastTone = params.toast === 'LOGIN_SUCCESS'
    ? 'success'
    : toastMessage
      ? /no se pudo|no tienes|debes|rechaz|no encontramos|no hay|invalid|forbidden/i.test(toastMessage)
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

  const institutionNames = profile?.role === 'APODERADO'
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

  let accessEventsQuery = supabase
    .from('access_events')
    .select('id, event_type, exit_kind, validation_kind, result, occurred_at, notes, students(id, first_name, last_name)')
    .order('occurred_at', { ascending: false })
    .limit(8);

  if (profile?.role === 'APODERADO') {
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
        exit_kind: ar.request_type === 'EXIT_ALONE' ? 'SOLO' : 'RETIRO_AUTORIZADO',
        validation_kind: 'SOLICITUD',
        result: ar.status,
        occurred_at: ar.responded_at ?? ar.requested_at,
        notes: ar.reason ?? (isPending ? 'Esperando respuesta del apoderado.' : requestLabel),
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
  ]
    .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
    .slice(0, 8);

  const displayName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || profile?.email || null;
  const recentEventStorageScope = `dashboard:${profile?.role ?? 'SIN_ROL'}:${user.id}`;
  const institutionLabel = institutionNames.length > 1 ? 'Instituciones' : 'Institución';
  const institutionEmptyText = profile?.role === 'APODERADO' ? 'Sin instituciones vinculadas' : 'No asignada';
  const dashboardCopy = getDashboardCopy(profile?.role, profile?.first_name, profile?.email);
  const roleActionItems = getRoleActionItems(profile?.role);
  const autoRefreshExpiresAt = [
    pendingStudentAuthorizationRequest?.expires_at,
    ...pendingAuthorizationRequests.map((request) => request.expiresAt),
  ];

  return (
    <main className="min-h-screen bg-slate-50">
      <DashboardAutoRefresh expiresAt={autoRefreshExpiresAt} />
      <FeedbackToast message={toastMessage} tone={toastTone} title="Dashboard" />
      <AppNav role={profile?.role} displayName={displayName} />

      <section className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <div className="grid gap-4 rounded-2xl bg-slate-900 p-4 text-white shadow-lg sm:p-6 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] md:rounded-3xl">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.2em] text-sky-200 sm:text-sm sm:tracking-[0.25em]">{dashboardCopy.eyebrow}</p>
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
                  {currentStudent?.canLeaveAlone ? (
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
                  ) : currentStudent ? (
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
                            Pide aprobación a tu apoderado. Portería registrará la salida solo cuando confirmes el evento.
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
                          Ya existe una solicitud de retiro vigente. Espera la respuesta de tu apoderado antes de crear una nueva.
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
                  ) : null}

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
                      No hay apoderados o responsables vinculados para mostrar.
                    </div>
                  )}
                </div>
              ) : linkedStudents && linkedStudents.length > 0 ? (
                linkedStudents.map((item) => {
                  const student = Array.isArray(item.students) ? item.students[0] : item.students;
                  if (!student) return null;
                  const institutionName = getInstitutionName(student.institutions);

                  return (
                    <article key={item.id} className="min-w-0 rounded-2xl border border-slate-200 p-4 sm:p-5">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <h3 className="break-words text-lg font-semibold text-slate-900">
                            {student.first_name} {student.last_name}
                          </h3>
                          <p className="mt-1 break-words text-sm text-slate-500">Relación: {item.relation_type ?? 'APODERADO'}</p>
                          <p className="mt-1 break-words text-sm text-slate-500">
                            Institución: {institutionName ?? 'Sin institución'}
                          </p>
                          <p className="mt-1 break-words text-sm text-slate-500">Código de vinculación: {student.link_code}</p>
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
                        <Link href={`/students/${student.id}`} className="rounded-xl border border-slate-300 px-4 py-2 text-center text-sm font-medium text-slate-700 hover:bg-slate-50">
                          Ver detalle
                        </Link>
                        <form action={unlinkStudentAction} className="sm:w-auto">
                          <input type="hidden" name="relation_id" value={item.id} />
                          <PendingSubmitButton
                            pendingLabel="Desvinculando..."
                            className="w-full rounded-xl border border-rose-300 px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:bg-rose-50 disabled:text-rose-300 sm:w-auto"
                          >
                            Desvincular
                          </PendingSubmitButton>
                        </form>
                      </div>
                    </article>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
                  {profile?.role === 'APODERADO'
                    ? 'No tienes estudiantes vinculados para mostrar.'
                    : 'No hay apoderados o responsables vinculados para mostrar.'}
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
                          <PendingSubmitButton
                            name="decision"
                            value="APPROVED"
                            pendingLabel="Procesando..."
                            className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-emerald-300"
                          >
                            Aprobar
                          </PendingSubmitButton>
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
                        {student ? `${student.first_name} ${student.last_name}` : 'Estudiante'} · {event.event_type}
                      </p>
                      {event.isAuthRequest ? (
                        <p className="mt-1 break-words text-sm text-slate-500">{event.requestLabel}</p>
                      ) : null}
                      <p className={`mt-1 break-words text-sm text-slate-500 ${event.isAuthRequest ? 'hidden' : ''}`}>
                        {event.validation_kind} · {event.result} · {event.event_type === 'SALIDA' ? event.exit_kind ?? 'Sin clasificar' : 'Ingreso'}
                      </p>
                      {event.notes ? (
                        <div className="mt-3 break-words rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                          <span className="font-medium text-slate-900">Descripción:</span> {event.notes}
                        </div>
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
