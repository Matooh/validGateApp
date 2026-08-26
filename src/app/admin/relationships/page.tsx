import { redirect } from 'next/navigation';

import {
  removeGuardianRelationshipAction,
  saveGuardianRelationshipAction,
} from '@/app/actions/guardian-relationships';
import { AppNav } from '@/components/app-nav';
import { PendingSubmitButton } from '@/components/pending-submit-button';
import { GuardianRelationshipsList, type GuardianRelationship } from '@/components/guardian-relationships-list';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

type GuardianCandidate = {
  profile_id: string;
  guardian_name: string;
  guardian_email: string;
};

type StudentCandidate = {
  student_id: number;
  student_name: string;
  course_name: string | null;
};

const MESSAGE_STYLES: Record<string, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  error: 'border-rose-200 bg-rose-50 text-rose-700',
  info: 'border-amber-200 bg-amber-50 text-amber-700',
};

export default async function GuardianRelationshipsPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; kind?: string }>;
}) {
  const { profile } = await requireUser();
  if (profile?.role !== 'ADMIN' || !profile.institution_id) {
    redirect('/dashboard?message=No+tienes+permisos+para+gestionar+vinculaciones');
  }

  const supabase = await createClient();
  const [guardiansResult, studentsResult, relationshipsResult] = await Promise.all([
    supabase.rpc('admin_list_guardian_candidates'),
    supabase.rpc('admin_list_students_for_guardian_links'),
    supabase.rpc('admin_list_guardian_student_links'),
  ]);

  const guardians = (guardiansResult.data ?? []) as GuardianCandidate[];
  const students = (studentsResult.data ?? []) as StudentCandidate[];
  const courseByStudentId = new Map(students.map((student) => [student.student_id, student.course_name]));
  const relationships = ((relationshipsResult.data ?? []) as Omit<GuardianRelationship, 'student_course'>[])
    .map((relationship) => ({
      ...relationship,
      student_course: courseByStudentId.get(relationship.student_id) ?? null,
    }));
  const hasLoadError = Boolean(guardiansResult.error || studentsResult.error || relationshipsResult.error);
  const params = await searchParams;
  const messageKind = params.kind && MESSAGE_STYLES[params.kind] ? params.kind : 'info';
  const canCreateRelationship = guardians.length > 0 && students.length > 0 && !hasLoadError;

  return (
    <main className="min-h-screen bg-slate-50">
      <AppNav
        role={profile.role}
        displayName={[profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.email}
      />

      <section className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Vinculación Apoderado-Estudiante</h1>
          <p className="mt-2 text-slate-600">
            Relaciona cuentas de apoderado existentes con estudiantes de tu institución.
          </p>
        </div>

        {params.message ? (
          <p className={`rounded-xl border px-4 py-3 text-sm ${MESSAGE_STYLES[messageKind]}`}>
            {params.message}
          </p>
        ) : null}

        {hasLoadError ? (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            No se pudo cargar la administración de vinculaciones. Verifica que la migración 018 esté aplicada en Supabase.
          </p>
        ) : null}

        <form action={saveGuardianRelationshipAction} className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Agregar vinculación</h2>
            <p className="mt-1 text-sm text-slate-500">
              Solo se muestran estudiantes y apoderados asociados a tu institución.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <label htmlFor="student_id" className="mb-2 block text-sm font-medium text-slate-700">Estudiante</label>
              <select id="student_id" name="student_id" required disabled={!canCreateRelationship} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 disabled:bg-slate-100">
                <option value="">Selecciona un estudiante</option>
                {students.map((student) => (
                  <option key={student.student_id} value={student.student_id}>
                    {student.student_name}{student.course_name ? ` · ${student.course_name}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="guardian_profile_id" className="mb-2 block text-sm font-medium text-slate-700">Apoderado</label>
              <select id="guardian_profile_id" name="guardian_profile_id" required disabled={!canCreateRelationship} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 disabled:bg-slate-100">
                <option value="">Selecciona un apoderado</option>
                {guardians.map((guardian) => (
                  <option key={guardian.profile_id} value={guardian.profile_id}>
                    {guardian.guardian_name} · {guardian.guardian_email}
                  </option>
                ))}
              </select>
            </div>

            <input type="hidden" name="relation_type" value="APODERADO" />
          </div>

          {!guardians.length && !hasLoadError ? (
            <p className="text-sm text-amber-700">No hay cuentas con rol APODERADO disponibles en esta institución.</p>
          ) : null}
          {!students.length && !hasLoadError ? (
            <p className="text-sm text-amber-700">No hay estudiantes registrados en esta institución.</p>
          ) : null}

          <PendingSubmitButton
            pendingLabel="Guardando..."
            disabled={!canCreateRelationship}
            className="rounded-xl bg-sky-700 px-4 py-3 font-semibold text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-sky-300"
          >
            Guardar vinculación
          </PendingSubmitButton>
        </form>

        <GuardianRelationshipsList relationships={relationships} />
      </section>
    </main>
  );
}
