import { AppNav } from '@/components/app-nav';
import { requireUser } from '@/lib/auth';
import { updatePasswordAction, updateProfileAction } from '@/app/actions/auth';

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { profile } = await requireUser();
  const params = await searchParams;

  return (
    <main className="min-h-screen bg-slate-50">
      <AppNav role={profile?.role} displayName={[profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || profile?.email} />
      <section className="mx-auto max-w-4xl space-y-6 px-6 py-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Configuracion de perfil</h1>
          <p className="mt-2 text-slate-600">Actualiza tu informacion personal y cambia tu password.</p>
        </div>

        {params.message ? (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{params.message}</p>
        ) : null}

        <div className="grid gap-6 md:grid-cols-2">
          <form action={updateProfileAction} className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Datos personales</h2>
            <div>
              <label htmlFor="first_name" className="mb-2 block text-sm font-medium text-slate-700">Nombres</label>
              <input id="first_name" name="first_name" defaultValue={profile?.first_name ?? ''} className="w-full rounded-xl border border-slate-300 px-4 py-3" />
            </div>
            <div>
              <label htmlFor="last_name" className="mb-2 block text-sm font-medium text-slate-700">Apellidos</label>
              <input id="last_name" name="last_name" defaultValue={profile?.last_name ?? ''} className="w-full rounded-xl border border-slate-300 px-4 py-3" />
            </div>
            <button type="submit" className="rounded-xl bg-sky-700 px-4 py-3 font-semibold text-white hover:bg-sky-800">Guardar cambios</button>
          </form>

          <form action={updatePasswordAction} className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Cambiar password</h2>
            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-700">Nueva password</label>
              <input id="password" name="password" type="password" className="w-full rounded-xl border border-slate-300 px-4 py-3" />
            </div>
            <button type="submit" className="rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white hover:bg-slate-700">Actualizar password</button>
          </form>
        </div>
      </section>
    </main>
  );
}
