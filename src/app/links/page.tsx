import { redirect } from 'next/navigation';

import { AppNav } from '@/components/app-nav';
import { AuthorizedRetrieverForm } from '@/components/authorized-retriever-form';
import { FeedbackToast } from '@/components/feedback-toast';
import { PrimaryGuardianRelationshipForm } from '@/components/primary-guardian-relationship-form';
import { VisibleLinksList, type VisibleLinkItem } from '@/components/visible-links-list';
import { requireUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import type { AppRole } from '@/lib/types';

type StudentOption = { student_id: number; student_name: string; institution_name: string };
type GuardianOption = { id: string; first_name: string | null; last_name: string | null; email: string | null };
type LegacyLink = { student_id: number; student_name: string; institution_name: string; guardian_profile_id: string; guardian_name: string | null; guardian_email: string; relation_type: string };

function isMissingRpc(error: { code?: string } | null) { return error?.code === 'PGRST202'; }

export default async function LinksPage({ searchParams }: { searchParams: Promise<{ message?: string; kind?: string }> }) {
  const { profile } = await requireUser();
  const role = profile?.role as AppRole | undefined;
  if (!hasPermission(role, 'view_links')) redirect('/dashboard?message=No+tienes+permiso+para+esta+secci%C3%B3n');

  const supabase = await createClient();
  const admin = createAdminClient();
  const [visibleResult, availableResult] = await Promise.all([
    supabase.rpc('list_visible_student_links'),
    hasPermission(role, 'authorize_retirador') ? supabase.rpc('list_students_available_for_retirador_authorization') : Promise.resolve({ data: [], error: null }),
  ]);
  let linksError = visibleResult.error;
  let links = (visibleResult.data ?? []) as VisibleLinkItem[];

  if (isMissingRpc(visibleResult.error) || role === 'DOCENTE') {
    const legacy = await supabase.rpc('get_student_guardian_links');
    linksError = legacy.error;
    links = ((legacy.data ?? []) as LegacyLink[]).map((link, index) => ({
      relation_id: -(index + 1), student_id: link.student_id, student_name: link.student_name,
      institution_name: link.institution_name, person_profile_id: link.guardian_profile_id,
      person_name: link.guardian_name || link.guardian_email, relation_type: link.relation_type === 'RETIRADOR_AUTORIZADO' ? 'RETIRADOR_AUTORIZADO' : 'APODERADO',
      valid_from: null, valid_until: null, revoked_at: null, is_active: true, can_revoke: false,
    }));
  }
  links = links.filter((link) => link.relation_type !== 'RETIRADOR_AUTORIZADO' || link.is_active);

  let students = (availableResult.data ?? []) as StudentOption[];
  let guardians: GuardianOption[] = [];
  if (admin && profile?.institution_id) {
    const result = await admin.from('profiles').select('id, first_name, last_name, email').eq('institution_id', profile.institution_id).eq('role', 'APODERADO').order('last_name');
    guardians = (result.data ?? []) as GuardianOption[];
  }
  const params = await searchParams;
  const canManage = hasPermission(role, 'authorize_retirador');

  return (
    <main className="min-h-screen bg-slate-50">
      <FeedbackToast message={params.message} tone={params.kind === 'error' ? 'danger' : params.kind === 'success' ? 'success' : 'info'} clearQueryParams={['message', 'kind']} />
      <AppNav role={role} displayName={[profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || profile?.email} />
      <section className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <div><h1 className="text-3xl font-bold text-slate-900">Vínculos</h1><p className="mt-2 text-slate-600">Relaciones visibles para tu cuenta, organizadas con el estudiante como centro.</p></div>
        {linksError ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">No fue posible cargar los vínculos.</p> : null}

        <details data-accordion open className="group rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <summary className="cursor-pointer list-none text-xl font-semibold text-slate-900">Relaciones actuales <span className="float-right text-slate-400 group-open:rotate-180">⌄</span></summary>
          <div className="mt-5"><VisibleLinksList links={links} role={role} /></div>
        </details>

        {canManage ? <details data-accordion className="group rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <summary className="cursor-pointer list-none text-xl font-semibold text-slate-900">{role === 'ADMIN' ? 'Gestionar vinculaciones' : 'Vinculación Apoderado Secundario-Estudiante'} <span className="float-right text-slate-400 group-open:rotate-180">⌄</span></summary>
          <div className="mt-5 space-y-5">
            {role === 'ADMIN' ? <details data-accordion className="group rounded-2xl border border-slate-200 p-4"><summary className="cursor-pointer list-none font-semibold text-slate-900">Vinculación Apoderado Primario-Estudiante <span className="float-right text-slate-400 group-open:rotate-180">⌄</span></summary><PrimaryGuardianRelationshipForm students={students} guardians={guardians} />
            </details> : null}
            <details data-accordion className="group rounded-2xl border border-slate-200 p-4"><summary className="cursor-pointer list-none font-semibold text-slate-900">Vinculación Apoderado Secundario-Estudiante <span className="float-right text-slate-400 group-open:rotate-180">⌄</span></summary><div className="mt-4"><AuthorizedRetrieverForm students={students} guardians={guardians} /></div></details>
          </div>
        </details> : null}
      </section>
    </main>
  );
}
