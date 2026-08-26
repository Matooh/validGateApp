import { redirect } from 'next/navigation';

import { FeedbackToast } from '@/components/feedback-toast';
import { LoginForm } from '@/components/login-form';
import { createClient } from '@/lib/supabase/server';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; toast?: string }>;
}) {
  const params = await searchParams;
  const message = params.message ?? null;
  const toastCode = params.toast ?? null;

  const toastMessage =
    toastCode === 'LOGOUT_SUCCESS'
      ? 'Sesión cerrada correctamente.'
      : message;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <FeedbackToast
        message={toastMessage}
        tone={toastCode === 'LOGOUT_SUCCESS' ? 'success' : 'info'}
        title="Acceso"
        clearQueryParams={['toast', 'message']}
      />
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 lg:grid lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <section className="space-y-6">
          <div>
            <p className="text-2xl font-bold text-slate-900 sm:text-3xl">ValidGateApp</p>
            <p className="mt-2 text-sm text-slate-500 sm:text-base">
              Control de ingreso y salida estudiantil
            </p>
          </div>

          <div className="space-y-4">
            <span className="inline-flex rounded-full bg-sky-100 px-4 py-1 text-sm font-medium text-sky-700">
              MVP validado en entorno local controlado
            </span>
          </div>
        </section>

        <section className="w-full">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <LoginForm />
          </div>

          <p className="mt-6 text-center text-sm text-slate-500">
            Version 1.0.0 · Fecha de lanzamiento base 2024-06-01
          </p>
        </section>
      </div>
    </main>
  );
}
