import { redirect } from 'next/navigation';

import { revokeAuthorizedRetiradorAction } from '@/app/actions/authorized-retrievers';
import { AppNav } from '@/components/app-nav';
import { AuthorizedRetrieverForm } from '@/components/authorized-retriever-form';
import { FeedbackToast } from '@/components/feedback-toast';
import { PendingSubmitButton } from '@/components/pending-submit-button';
import { requireUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import type { AppRole } from '@/lib/types';

type VisibleLink = {
  relation_id: number;
  student_id: number;
  student_name: string;
  institution_name: string;
  person_profile_id: string;
  person_name: string;
  relation_type: 'APODERADO' | 'RETIRADOR_AUTORIZADO';
  valid_from: string | null;
  valid_until: string | null;
  revoked_at: string | null;
  is_active: boolean;
  can_revoke: boolean;
};

type StudentOption = { student_id: number; student_name: string; institution_name: string };

type LegacyVisibleLink = {
  student_id: number;
  student_name: string;
  institution_name: string;
  guardian_profile_id: string;
  guardian_name: string | null;
  guardian_email: string;
  relation_type: VisibleLink['relation_type'];
};

function isMissingRpc(error: { code?: string } | null) {
  return error?.code === 'PGRST202';
}

function uniqueStudentsFromLinks(links: VisibleLink[]): StudentOption[] {
  return Array.from(
    new Map(
      links.map((link) => [
        link.student_id,
        {
          student_id: link.student_id,
          student_name: link.student_name,
          institution_name: link.institution_name,
        },
      ]),
    ).values(),
  );
}

function relationshipLabel(type: VisibleLink['relation_type']) {
  return type === 'APODERADO' ? 'Apoderado' : 'Retirador autorizado';
}

export default async function LinksPage({ searchParams }: { searchParams: Promise<{ message?: string; kind?: string }> }) {
  const { profile } = await requireUser();
  const role = profile?.role as AppRole | undefined;
  if (!hasPermission(role, 'view_links')) redirect('/dashboard?message=No+tienes+permisos+para+ver+vínculos');

  const supabase = await createClient();
  const [visibleLinksResult, availableStudentsResult] = await Promise.all([
    supabase.rpc('list_visible_student_links'),
    hasPermission(role, 'authorize_retirador')
      ? supabase.rpc('list_students_available_for_retirador_authorization')
      : Promise.resolve({ data: [], error: null }),
  ]);

  let linksError = visibleLinksResult.error;
  let links = (visibleLinksResult.data ?? []) as VisibleLink[];

  // Mantiene visible la relación permanente cuando la aplicación se despliega
  // antes que la migración que incorpora las autorizaciones temporales.
  if (isMissingRpc(visibleLinksResult.error)) {
    const legacyResult = await supabase.rpc('get_student_guardian_links');
    linksError = legacyResult.error;
    links = ((legacyResult.data ?? []) as LegacyVisibleLink[]).map((link, index) => ({
      relation_id: -(index + 1),
      student_id: link.student_id,
      student_name: link.student_name,
      institution_name: link.institution_name,
      person_profile_id: link.guardian_profile_id,
      person_name: link.guardian_name || link.guardian_email,
      relation_type: link.relation_type,
      valid_from: null,
      valid_until: null,
      revoked_at: null,
      is_active: true,
      can_revoke: false,
    }));
  }

  let students = (availableStudentsResult.data ?? []) as StudentOption[];
  if (hasPermission(role, 'authorize_retirador') && isMissingRpc(availableStudentsResult.error)) {
    students = uniqueStudentsFromLinks(links);
  }
  const params = await searchParams;
  const grouped = links.reduce<Record<string, VisibleLink[]>>((result, link) => {
    (result[link.student_id] ??= []).push(link);
    return result;
  }, {});

  return (
    <main className="min-h-screen bg-slate-50">
      <FeedbackToast message={params.message} tone={params.kind === 'error' ? 'danger' : params.kind === 'success' ? 'success' : 'info'} clearQueryParams={['message', 'kind']} />
      <AppNav role={role} displayName={[profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || profile?.email} />
      <section className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Vínculos</h1>
          <p className="mt-2 text-slate-600">Relaciones visibles para tu cuenta, organizadas con el estudiante como centro.</p>
        </div>

        {linksError ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">No fue posible cargar los vínculos.</p> : null}

        <div className="grid gap-4 lg:grid-cols-2">
          {Object.values(grouped).map((studentLinks) => {
            const student = studentLinks[0];
            return (
              <article key={student.student_id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">Estudiante</p>
                <h2 className="mt-1 text-xl font-semibold text-slate-900">{student.student_name}</h2>
                <p className="text-sm text-slate-500">{student.institution_name}</p>
                <div className="mt-5 space-y-3">
                  {studentLinks.map((link) => (
                    <div key={link.relation_id} className="rounded-2xl border border-slate-200 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">{link.person_name}</p>
                          <p className="mt-1 text-sm text-slate-600">{relationshipLabel(link.relation_type)}</p>
                          {link.relation_type === 'RETIRADOR_AUTORIZADO' && link.valid_from && link.valid_until ? (
                            <p className="mt-1 text-xs text-slate-500">Desde {new Date(link.valid_from).toLocaleString('es-CL')} hasta {new Date(link.valid_until).toLocaleString('es-CL')}</p>
                          ) : null}
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${link.is_active ? 'bg-emerald-100 text-emerald-800' : link.revoked_at ? 'bg-slate-100 text-slate-700' : 'bg-gray-100 text-gray-700'}`}>
                          {link.is_active ? 'Vigente' : link.revoked_at ? 'Revocado' : 'Vencido'}
                        </span>
                      </div>
                      {link.can_revoke ? (
                        <form action={revokeAuthorizedRetiradorAction} className="mt-3">
                          <input type="hidden" name="relation_id" value={link.relation_id} />
                          <PendingSubmitButton pendingLabel="Revocando..." className="rounded-xl border border-rose-300 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50">Revocar autorización</PendingSubmitButton>
                        </form>
                      ) : null}
                    </div>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
        {!links.length && !linksError ? <p className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">No tienes vínculos disponibles.</p> : null}

        {hasPermission(role, 'authorize_retirador') ? <AuthorizedRetrieverForm students={students} /> : null}
      </section>
    </main>
  );
}
