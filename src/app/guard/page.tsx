import Link from 'next/link';
import { redirect } from 'next/navigation';

import { AppNav } from '@/components/app-nav';
import { FeedbackToast } from '@/components/feedback-toast';
import { QrCredentialValidator } from '@/components/qr-credential-validator';
import { RecordAccessForm } from '@/components/record-access-form';
import { RecentEventCard } from '@/components/recent-event-card';
import { requireStaff } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import { DEFAULT_ACCESS_POLICY } from '@/lib/types';

export default async function GuardPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { user, profile } = await requireStaff();
  const supabase = await createClient();
  const params = await searchParams;
  const toastMessage = params.message ?? null;

  const toastTone = toastMessage
    ? /no se pudo|no tienes|debes|rechaz|no encontramos|no hay|invalid|forbidden/i.test(toastMessage)
      ? 'danger'
      : /atencion|advert|existe|pendiente/i.test(toastMessage)
        ? 'warning'
        : 'success'
    : 'info';

  if (!hasPermission(profile?.role ?? null, 'view_guard_module')) {
    redirect('/dashboard');
  }

  const institutionId = profile?.institution_id;

  const [
    { data: students },
    { data: courses },
    { count: totalStudents },
    { data: institution },
    { data: accessPolicy },
  ] = await Promise.all([
    supabase
      .from('students')
      .select('id, first_name, last_name, is_in_institution, can_leave_alone, course_id')
      .eq('institution_id', institutionId)
      .order('first_name', { ascending: true }),
    supabase
      .from('courses')
      .select('id, name')
      .eq('institution_id', institutionId)
      .order('name', { ascending: true }),
    supabase
      .from('students')
      .select('*', { count: 'exact', head: true })
      .eq('institution_id', institutionId),
    supabase
      .from('institutions')
      .select('name')
      .eq('id', institutionId)
      .maybeSingle(),
    supabase
      .from('institution_access_policies')
      .select(
        'entry_requires_authenticator, entry_authenticator_is_exclusive, exit_requires_authenticator, exit_authenticator_is_exclusive, exit_requires_observation_without_authenticator',
      )
      .eq('institution_id', institutionId)
      .maybeSingle(),
  ]);

  const { data: events } = await supabase
    .from('access_events')
    .select(
      'id, event_type, exit_kind, validation_kind, result, occurred_at, notes, authenticator_required, authenticator_presented, policy_failure, students(id, first_name, last_name)',
    )
    .order('occurred_at', { ascending: false })
    .limit(10);

  const institutionName = institution?.name ?? 'Institucion no disponible';
  const recentEventStorageScope = `guard:${profile?.role ?? 'SIN_ROL'}:${user.id}:access`;

  return (
    <main className="min-h-screen bg-slate-50">
      <FeedbackToast message={toastMessage} tone={toastTone} title="Porteria" />
      <AppNav
        role={profile?.role}
        displayName={
          [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') ||
          profile?.email
        }
      />

      <section className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
            Logica de control de ingreso y salida
          </h1>
          <p className="mt-2 text-sm text-slate-600 sm:text-base">
            Pantalla orientada a porteria, administracion o docente autorizado.
          </p>
        </div>

        <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Institucion operativa</p>
            <p className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">
              {institutionName}
            </p>
          </div>

          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Estudiantes reales cargados</p>
            <p className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">
              {totalStudents ?? students?.length ?? 0}
            </p>
          </div>

          <div className="rounded-2xl bg-slate-50 p-4 sm:col-span-2 lg:col-span-1">
            <p className="text-sm text-slate-500">Cursos disponibles</p>
            <p className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">
              {courses?.length ?? 0}
            </p>
          </div>
        </section>

        <QrCredentialValidator />

        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <RecordAccessForm
            students={students ?? []}
            courses={courses ?? []}
            accessPolicy={{ ...DEFAULT_ACCESS_POLICY, ...(accessPolicy ?? {}) }}
          />

          <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">
                  Eventos recientes
                </h2>
                <p className="text-sm text-slate-500">
                  Trazabilidad operacional del establecimiento.
                </p>
              </div>

              <Link
                href="/dashboard"
                className="text-sm font-medium text-sky-700 hover:underline"
              >
                Ir al dashboard
              </Link>
            </div>

            <div className="space-y-3">
              {(events ?? []).length > 0 ? (
                events?.map((event) => {
                  const student = Array.isArray(event.students)
                    ? event.students[0]
                    : event.students;
                  // TODO: reemplazar por una condicion real cuando exista un estado
                  // de evento nuevo/no leido o de visualizacion por usuario.
                  const shouldShowNewBadge = true;

                  return (
                    <RecentEventCard
                      key={event.id}
                      eventId={String(event.id)}
                      storageScope={recentEventStorageScope}
                      showNewBadge={shouldShowNewBadge}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">
                            {student
                              ? `${student.first_name} ${student.last_name}`
                              : 'Estudiante'}{' '}
                            · {event.event_type}
                          </p>

                          <p className="mt-1 text-sm text-slate-500">
                            {event.validation_kind} · {event.result} ·{' '}
                            {event.event_type === 'SALIDA'
                              ? event.exit_kind ?? 'Sin clasificar'
                              : 'Ingreso'}
                          </p>

                          {event.authenticator_required ? (
                            <p className="mt-1 text-xs font-medium text-slate-500">
                              Autenticador requerido:{' '}
                              {event.authenticator_presented ? 'presentado' : 'no presentado'}
                              {event.policy_failure ? ` · Regla: ${event.policy_failure}` : ''}
                            </p>
                          ) : null}

                          {event.notes ? (
                            <p className="mt-2 text-sm text-slate-600">
                              <span className="font-medium text-slate-800">
                                Descripcion:
                              </span>{' '}
                              {event.notes}
                            </p>
                          ) : null}
                        </div>

                        <p className="text-xs text-slate-400">
                          {new Date(event.occurred_at).toLocaleString('es-CL')}
                        </p>
                      </div>
                    </RecentEventCard>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                  Aun no hay eventos registrados para mostrar.
                </div>
              )}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
