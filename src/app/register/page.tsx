import { RegisterForm } from '@/components/register-form';

export default function RegisterPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-10">
      <div className="mb-8 text-center">
        <p className="text-sm font-medium uppercase tracking-[0.25em] text-sky-700">ValidGateApp</p>
        <h1 className="mt-3 text-3xl font-bold text-slate-900">Registro de usuario</h1>
        <p className="mt-2 text-slate-600">Para este MVP el registro es simple: user y password.</p>
      </div>
      <RegisterForm />
    </main>
  );
}
