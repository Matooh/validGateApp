import { notFound } from 'next/navigation';

import { updateAttendanceStatusAction, updateStudentAction } from '@/app/actions/students';
import { AppNav } from '@/components/app-nav';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

const STATUS_STYLE: Record<string, string> = {
  PRESENTE: 'bg-emerald-100 text-emerald-700',
  AUSENTE: 'bg-rose-100 text-rose-700',
  TARDANZA: 'bg-amber-100 text-amber-700',
  SALIDA: 'bg-sky-100 text-sky-700',
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

export default async function StudentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ message?: string }>;
}) {
  const { id } = await params;
  const { user, profile } = await requireUser();
  const supabase = await createClient();
  const messageParams = await searchParams;
  const studentId = Number(id);

  const isStaff = ['ADMIN', 'PORTERIA', 'DOCENTE'].includes(profile?.role ?? '');

  let studentQuery = supabase
    .from('students')
    .select('id, first_name, last_name, can_leave_alone, is_in_institution, link_code, course_id')
    .eq('id', studentId);

  if (!isStaff) {
    const { data: link } = await supabase
      .from('guardian_students')
      .select('id')
      .eq('guardian_profile_id', user.id)
      .eq('student_id', studentId)
      .maybeSingle();

    if (!link) {
      notFound();
    }
  }

  const { data: student } = await studentQuery.single();

  if (!student) {
    notFound();
  }

  const { data: scheduleBlocks } = await supabase
    .from('schedule_blocks')
    .select('id, block_name, block_kind, start_time, end_time, location, exit_allowed')
    .eq('course_id', student.course_id)
    .order('start_time', { ascending: true });

  const { data: attendanceBlocks } = await supabase
    .from('attendance_blocks')
    .select('schedule_block_id, status, note')
    .eq('student_id', studentId)
    .eq('attendance_date', new Date().toISOString().slice(0, 10));

  const { data: guardianLinks } = await supabase.rpc('get_student_guardian_links', {
    p_student_ids: [studentId],
  });

  const attendanceByBlock = new Map((attendanceBlocks ?? []).map((item) => [item.schedule_block_id, item]));
  const links = (guardianLinks ?? []) as StudentGuardianLink[];

  return (
    <main className="min-h-screen bg-slate-50">
      <AppNav role={profile?.role} displayName={[profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || profile?.email} />
      <section className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        <div className="flex flex-wrap items-start justify-between gap-4 rounded-3xl bg-white p-6 shadow-sm">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-sky-700">Detalle estudiante</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">
              {student.first_name} {student.last_name}
            </h1>
            <p className="mt-2 text-slate-600">Codigo de vinculacion: {student.link_code}</p>
          </div>
          <div className="flex flex-col gap-3">
            <span
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                student.is_in_institution ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {student.is_in_institution ? 'Dentro de la institucion' : 'Fuera de la institucion'}
            </span>
            <span className="rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-700">
              {student.can_leave_alone ? 'Puede salir solo' : 'No puede salir solo'}
            </span>
          </div>
        </div>

        {messageParams.message ? (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{messageParams.message}</p>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-6">
            <form action={updateStudentAction} className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">Configuracion del estudiante</h2>
              <input type="hidden" name="student_id" value={student.id} />
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4 text-slate-700">
                <input name="can_leave_alone" type="checkbox" defaultChecked={student.can_leave_alone} className="h-4 w-4" />
                Permitir salida por voluntad del estudiante
              </label>
              <button type="submit" className="rounded-xl bg-sky-700 px-4 py-3 font-semibold text-white hover:bg-sky-800">
                Guardar configuracion
              </button>
            </form>

            <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Vinculos del estudiante</h2>
                <p className="text-sm text-slate-500">
                  {isStaff ? 'Personas con cuenta vinculadas a este estudiante.' : 'Tus vinculos visibles para este estudiante.'}
                </p>
              </div>
              <div className="space-y-3">
                {links.length > 0 ? (
                  links.map((link) => (
                    <article key={`${link.student_id}-${link.guardian_profile_id}`} className="rounded-2xl border border-slate-200 p-4">
                      <p className="font-medium text-slate-900">{link.guardian_name || 'Usuario sin nombre'}</p>
                      <p className="mt-1 text-sm text-slate-500">{link.guardian_email || 'Sin correo'} · {link.relation_type || 'Sin relacion declarada'}</p>
                      <p className="mt-2 text-xs text-slate-400">Vinculado el {new Date(link.linked_at).toLocaleString('es-CL')}</p>
                    </article>
                  ))
                ) : (
                  <p className="rounded-2xl border border-dashed border-slate-300 p-5 text-sm text-slate-500">
                    Aun no hay cuentas vinculadas a este estudiante.
                  </p>
                )}
              </div>
            </section>
          </div>

          <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">School timetable del estudiante</h2>
              <p className="text-sm text-slate-500">Verde: asistencia · Rojo: inasistencia · Amarillo: tardanza.</p>
            </div>
            <div className="space-y-4">
              {(scheduleBlocks ?? []).map((block) => {
                const attendance = attendanceByBlock.get(block.id);
                const status = attendance?.status ?? 'AUSENTE';
                return (
                  <article key={block.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-slate-900">{block.block_name}</h3>
                        <p className="text-sm text-slate-500">
                          {block.start_time} - {block.end_time} · {block.block_kind} · {block.location ?? 'Sin ubicacion'}
                        </p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-sm font-medium ${STATUS_STYLE[status] ?? 'bg-slate-100 text-slate-700'}`}>
                        {status}
                      </span>
                    </div>
                    {isStaff ? (
                      <form action={updateAttendanceStatusAction} className="mt-4 flex flex-wrap items-center gap-3">
                        <input type="hidden" name="student_id" value={student.id} />
                        <input type="hidden" name="schedule_block_id" value={block.id} />
                        <select name="status" defaultValue={status} className="rounded-xl border border-slate-300 px-3 py-2 text-sm">
                          <option value="PRESENTE">PRESENTE</option>
                          <option value="AUSENTE">AUSENTE</option>
                          <option value="TARDANZA">TARDANZA</option>
                          <option value="SALIDA">SALIDA</option>
                        </select>
                        <button type="submit" className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                          Actualizar
                        </button>
                      </form>
                    ) : null}
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
