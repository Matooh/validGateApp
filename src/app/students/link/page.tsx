import { AppNav } from '@/components/app-nav';
import { LinkStudentForm } from '@/components/link-student-form';
import { requireUser } from '@/lib/auth';

const MESSAGE_STYLES: Record<string, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  error: 'border-rose-200 bg-rose-50 text-rose-700',
  info: 'border-amber-200 bg-amber-50 text-amber-700',
};

export default async function LinkStudentPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; kind?: string }>;
}) {
  const { profile } = await requireUser();
  const params = await searchParams;
  const messageKind = params.kind && MESSAGE_STYLES[params.kind] ? params.kind : 'info';

  return (
    <main className="min-h-screen bg-slate-50">
      <AppNav role={profile?.role} displayName={[profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || profile?.email} />
      <section className="mx-auto max-w-3xl space-y-6 px-6 py-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Vincular estudiante a cuenta</h1>
          <p className="mt-2 text-slate-600">Ingresa el codigo de vinculacion entregado por la institucion educativa.</p>
        </div>
        {params.message ? (
          <p className={`rounded-xl border px-4 py-3 text-sm ${MESSAGE_STYLES[messageKind]}`}>
            {params.message}
          </p>
        ) : null}
        <LinkStudentForm />
      </section>
    </main>
  );
}
