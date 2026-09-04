import { RegisterForm } from '@/components/register-form';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function RegisterPage() {
  const supabase = await createClient();
  const { data: publicInstitutions } = await supabase.rpc('list_registration_institutions');
  const admin = createAdminClient();
  const { data: adminInstitutions } = !publicInstitutions?.length && admin
    ? await admin.from('institutions').select('id, name').order('name')
    : { data: null };
  const institutions = publicInstitutions?.length ? publicInstitutions : adminInstitutions ?? [];

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-10">
      <div className="mb-8 text-center">
        <p className="text-sm font-medium uppercase tracking-[0.25em] text-sky-700">ValidGateApp</p>
        <h1 className="mt-3 text-3xl font-bold text-slate-900">Registro de usuario</h1>
        <p className="mt-2 text-slate-600">Completa todos los campos para crear tu cuenta.</p>
      </div>
      <RegisterForm institutions={institutions ?? []} />
    </main>
  );
}
