import { redirect } from 'next/navigation';

import { AppNav } from '@/components/app-nav';
import { CreateStudentForm } from '@/components/create-student-form';
import { RegisteredStudentsList } from '@/components/registered-students-list';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function AdminStudentsPage({ searchParams }: { searchParams: Promise<{ message?: string; kind?: string }> }) {
  const { profile } = await requireUser();
  if (profile?.role !== 'ADMIN' || !profile.institution_id) redirect('/dashboard?kind=error&message=No+tienes+permisos+para+gestionar+estudiantes');
  const supabase = await createClient();
  const [{ data: courses }, { data: rawStudents }] = await Promise.all([
    supabase.from('courses').select('id, name').eq('institution_id', profile.institution_id).order('name'),
    supabase.from('students').select('id, first_name, last_name, link_code, can_leave_alone, is_in_institution, courses(name)').eq('institution_id', profile.institution_id).order('last_name').order('first_name'),
  ]);
  const students = (rawStudents ?? []).map((student) => {
    const courseRelation = student.courses as { name: string } | { name: string }[] | null;
    return { ...student, course_name: (Array.isArray(courseRelation) ? courseRelation[0]?.name : courseRelation?.name) ?? null };
  });
  const params = await searchParams;
  return <main className="min-h-screen bg-slate-50"><AppNav role={profile.role} displayName={[profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.email} /><section className="mx-auto max-w-6xl space-y-6 px-6 py-8"><div><p className="text-sm uppercase tracking-[0.25em] text-sky-700">Administración</p><h1 className="mt-2 text-3xl font-bold text-slate-900">Estudiantes</h1><p className="mt-2 text-slate-600">Registra estudiantes de tu institución y entrega su código al apoderado.</p></div>{params.message ? <p className={`rounded-xl border px-4 py-3 text-sm ${params.kind === 'error' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{params.message}</p> : null}{!courses?.length ? <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">No hay cursos configurados para tu institución.</p> : null}<CreateStudentForm courses={courses ?? []} /><RegisteredStudentsList students={students} /></section></main>;
}
