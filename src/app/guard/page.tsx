import Link from 'next/link';

import { AppNav } from '@/components/app-nav';
import { RecordAccessForm } from '@/components/record-access-form';
import { requireStaff } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export default async function GuardPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { profile } = await requireStaff();
  const supabase = await createClient();
  const params = await searchParams;

  const institutionId = profile?.institution_id;

  const [{ data: students }, { data: courses }, { count: totalStudents }] = await Promise.all([
    supabase
      .from('students')
      .select('id, first_name, last_name, is_in_institution, course_id')
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
  ]);

  const { data: events } = await supabase
    .from('access_events')
    .select('id, event_type, exit_kind, validation_kind, result, occurred_at, notes, students(id, first_name, last_name)')
    .order('occurred_at', { ascending: false })
    .limit(10);

  return (
    <main className="min-h-screen bg-slate-50">
      <AppNav role={profile?.role} displayName={[profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || profile?.email} />
      <section className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Logica de control de ingreso y salida</h1>
          <p className="mt-2 text-slate-600">Pantalla orientada a porteria, administracion o docente autorizado.</p>
        </div>

        <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-3">
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Institucion operativa</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{institutionId ?? '-'}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Estudiantes reales cargados</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{totalStudents ?? students?.length ?? 0}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Cursos disponibles</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{courses?.length ?? 0}</p>
          </div>
        </section>

        {params.message ? (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{params.message}</p>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <RecordAccessForm students={students ?? []} courses={courses ?? []} />

          <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Eventos recientes</h2>
                <p className="text-sm text-slate-500">Trazabilidad operacional del establecimiento.</p>
              </div>
              <Link href="/dashboard" className="text-sm font-medium text-sky-700 hover:underline">
                Ir al dashboard
              </Link>
            </div>

            <div className="space-y-3">
              {(events ?? []).map((event) => {
                const student = Array.isArray(event.students) ? event.students[0] : event.students;
                return (
                  <article key={event.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">
                          {student ? `${student.first_name} ${student.last_name}` : 'Estudiante'} · {event.event_type}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {event.validation_kind} · {event.result} · {event.event_type === 'SALIDA' ? event.exit_kind ?? 'Sin clasificar' : 'Ingreso'}
                        </p>
                        {event.notes ? <p className="mt-2 text-sm text-slate-600"><span className="font-medium text-slate-800">Descripcion:</span> {event.notes}</p> : null}
                      </div>
                      <p className="text-xs text-slate-400">{new Date(event.occurred_at).toLocaleString('es-CL')}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
