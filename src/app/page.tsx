import { redirect } from 'next/navigation';

import { LoginForm } from '@/components/login-form';
import { createClient } from '@/lib/supabase/server';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect('/dashboard');
  }

  const params = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-10">
      <header className="mb-10 flex items-center justify-between gap-4 rounded-3xl border border-slate-200 bg-white/90 px-6 py-5 shadow-sm">
        <p className="text-2xl font-bold text-slate-900">ValidGateApp</p>
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <span className="rounded-full border border-slate-200 px-3 py-1">Perfil</span>
          <span className="rounded-full border border-slate-200 px-3 py-1">Config</span>
        </div>
      </header>

      <section className="mx-auto grid w-full max-w-5xl gap-8 md:grid-cols-[1.15fr_0.85fr] md:items-center">
        <div className="space-y-4">
          <p className="inline-flex rounded-full bg-sky-100 px-4 py-1 text-sm font-medium text-sky-700">MVP desplegable en Vercel</p>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">Controla ingreso, salida y trazabilidad de estudiantes desde una sola app.</h1>
          <p className="text-lg text-slate-600">
            Este MVP está pensado para tu tesis: login, registro, vínculo de estudiante, visualización de horario,
            asistencia por bloque y registro de eventos de acceso.
          </p>
          <ul className="space-y-2 text-slate-600">
            <li>• Login simple con remember me</li>
            <li>• Vinculación por código</li>
            <li>• Estado actual en institución</li>
            <li>• School timetable con colores</li>
            <li>• Registro de ingreso y salida</li>
          </ul>
        </div>

        <div>
          {params.message ? (
            <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{params.message}</p>
          ) : null}
          <LoginForm />
        </div>
      </section>

      <footer className="mt-auto pt-10 text-center text-sm text-slate-500">
        Version 1.0.0 · Fecha de lanzamiento base 2024-06-01
      </footer>
    </main>
  );
}
