import Link from 'next/link';

import { signOutAction } from '@/app/actions/auth';
import type { AppRole } from '@/lib/types';

type AppNavProps = {
  role?: AppRole | null;
  displayName?: string | null;
};

export function AppNav({ role, displayName }: AppNavProps) {
  const profileLabel = displayName?.trim() || 'Mi perfil';

  return (
    <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <div>
          <p className="text-lg font-bold text-slate-900">ValidGateApp</p>
          <p className="text-sm text-slate-500">Control de ingreso y salida estudiantil</p>
        </div>

        <nav className="flex flex-wrap items-center gap-3 text-sm font-medium text-slate-700">
          <Link href="/dashboard" className="rounded-lg px-3 py-2 hover:bg-slate-100">
            Dashboard
          </Link>
          <Link href="/students/link" className="rounded-lg px-3 py-2 hover:bg-slate-100">
            Vincular estudiante
          </Link>
          {(role === 'ADMIN' || role === 'PORTERIA' || role === 'DOCENTE') && (
            <Link href="/guard" className="rounded-lg px-3 py-2 hover:bg-slate-100">
              Porteria
            </Link>
          )}
          <Link href="/settings" className="rounded-lg px-3 py-2 hover:bg-slate-100">
            {profileLabel}
          </Link>
          <form action={signOutAction}>
            <button type="submit" className="rounded-lg bg-slate-900 px-3 py-2 text-white hover:bg-slate-700">
              Logout
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
