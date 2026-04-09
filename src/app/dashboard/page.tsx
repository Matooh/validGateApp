import Link from 'next/link';

import { unlinkStudentAction } from '@/app/actions/students';
import { AppNav } from '@/components/app-nav';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { user, profile } = await requireUser();
  const supabase = await createClient();
  const params = await searchParams;

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
          const institution = student && Array.isArray(student.institutions) ? student.institutions[0] : student?.institutions;
          return institution?.name?.trim();
        })
        .filter((value): value is string => Boolean(value))
    )
  );

  const institutionNames = profile?.role === 'APODERADO'
    ? linkedInstitutionNames
    : staffInstitutionName
      ? [staffInstitutionName]
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

  const { data: accessEvents } = await accessEventsQuery;
  const displayName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || profile?.email || null;
  const institutionLabel = institutionNames.length > 1 ? 'Instituciones' : 'Institucion';
  const institutionEmptyText = profile?.role === 'APODERADO' ? 'Sin instituciones vinculadas' : 'No asignada';

  return (
    <main className="min-h-screen bg-slate-50">
      <AppNav role={profile?.role} displayName={displayName} />

      <section className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        <div className="grid gap-4 rounded-3xl bg-slate-900 p-6 text-white shadow-lg md:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-sky-200">Dashboard</p>
            <h1 className="mt-2 text-3xl font-bold">Hola, {profile?.first_name || profile?.email || 'usuario'}.</h1>
            <p className="mt-2 max-w-2xl text-slate-300">
              Desde aqui puedes revisar estudiantes vinculados, acceder a su informacion, ver trazabilidad y, si tu rol lo permite,
              registrar ingresos y salidas.
            </p>
          </div>
          <div className="grid gap-3 rounded-2xl bg-white/10 p-4 text-sm">
            <div>
              <p className="text-slate-300">Rol</p>
              <p className="text-lg font-semibold">{profile?.role ?? 'SIN ROL'}</p>
            </div>
            <div>
              <p className="text-slate-300">{institutionLabel}</p>
              {institutionNames.length <= 1 ? (
                <p className="text-lg font-semibold">{institutionNames[0] ?? institutionEmptyText}</p>
              ) : (
                <div className="mt-2 flex flex-wrap gap-2">
                  {institutionNames.map((institutionName) => (
                    <span key={institutionName} className="rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-white ring-1 ring-white/20">
                      {institutionName}
                    </span>
                  ))}
                </div>
              )}
              {profile?.role === 'APODERADO' && institutionNames.length > 1 ? (
                <p className="mt-2 text-xs text-slate-300">Tienes estudiantes vinculados en multiples instituciones.</p>
              ) : null}
            </div>
          </div>
        </div>

        {params.message ? (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{params.message}</p>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Estudiantes vinculados</h2>
                <p className="text-sm text-slate-500">Configuracion de estudiantes y acceso a sus datos.</p>
              </div>
              <Link href="/students/link" className="rounded-xl bg-sky-700 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-800">
                Vincular estudiante
              </Link>
            </div>

            <div className="space-y-4">
              {linkedStudents && linkedStudents.length > 0 ? (
                linkedStudents.map((item) => {
                  const student = Array.isArray(item.students) ? item.students[0] : item.students;
                  if (!student) return null;

                  return (
                    <article key={item.id} className="rounded-2xl border border-slate-200 p-5">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <h3 className="text-lg font-semibold text-slate-900">
                            {student.first_name} {student.last_name}
                          </h3>
                          <p className="mt-1 text-sm text-slate-500">Relacion: {item.relation_type ?? 'APODERADO'}</p>
                          <p className="mt-1 text-sm text-slate-500">
                            Institucion: {(Array.isArray(student.institutions) ? student.institutions[0] : student.institutions)?.name ?? 'Sin institucion'}
                          </p>
                          <p className="mt-1 text-sm text-slate-500">Codigo de vinculacion: {student.link_code}</p>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-sm font-medium ${
                            student.is_in_institution ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {student.is_in_institution ? 'En institucion' : 'Fuera de institucion'}
                        </span>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-3">
                        <Link href={`/students/${student.id}`} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                          Ver detalle
                        </Link>
                        <form action={unlinkStudentAction}>
                          <input type="hidden" name="relation_id" value={item.id} />
                          <button type="submit" className="rounded-xl border border-rose-300 px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50">
                            Desvincular
                          </button>
                        </form>
                      </div>
                    </article>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
                  No tienes estudiantes vinculados todavia.
                </div>
              )}
            </div>
          </section>

          <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Trazabilidad reciente</h2>
              <p className="text-sm text-slate-500">
                {profile?.role === 'APODERADO'
                  ? 'Eventos mas recientes de tus estudiantes vinculados.'
                  : 'Ultimos eventos registrados en el sistema.'}
              </p>
            </div>
            <div className="space-y-3">
              {accessEvents && accessEvents.length > 0 ? (
                accessEvents.map((event) => {
                  const student = Array.isArray(event.students) ? event.students[0] : event.students;
                  return (
                    <article key={event.id} className="rounded-2xl border border-slate-200 p-4">
                      <p className="font-medium text-slate-900">
                        {student ? `${student.first_name} ${student.last_name}` : 'Estudiante'} · {event.event_type}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {event.validation_kind} · {event.result} · {event.event_type === 'SALIDA' ? event.exit_kind ?? 'Sin clasificar' : 'Ingreso'}
                      </p>
                      {event.notes ? (
                        <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                          <span className="font-medium text-slate-900">Descripcion:</span> {event.notes}
                        </div>
                      ) : null}
                      <p className="mt-2 text-xs text-slate-400">{new Date(event.occurred_at).toLocaleString('es-CL')}</p>
                    </article>
                  );
                })
              ) : (
                <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">Aun no hay eventos registrados.</p>
              )}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
