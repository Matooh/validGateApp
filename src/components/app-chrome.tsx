'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Squash as Hamburger } from 'hamburger-react';

import { signOutAction } from '@/app/actions/auth';

type NavItem = {
  href: string;
  label: string;
  icon: 'home' | 'student' | 'guard' | 'settings' | 'auth';
};

type AppChromeProps = {
  displayName: string;
  roleLabel: string;
  navItems: NavItem[];
};

function Icon({ name }: { name: NavItem['icon'] | 'logout' | 'profile' | 'close' }) {
  const baseClass = 'pointer-events-none h-6 w-6 stroke-current';

  if (name === 'close') {
    return (
      <svg className={baseClass} viewBox="0 0 24 24" fill="none" strokeWidth="2.5" aria-hidden="true">
        <path d="m6 6 12 12M18 6 6 18" />
      </svg>
    );
  }

  if (name === 'home') {
    return (
      <svg className={baseClass} viewBox="0 0 24 24" fill="none" strokeWidth="2.2" aria-hidden="true">
        <path d="m3 11 9-8 9 8" />
        <path d="M5 10v10h5v-6h4v6h5V10" />
      </svg>
    );
  }

  if (name === 'student') {
    return (
      <svg className={baseClass} viewBox="0 0 24 24" fill="none" strokeWidth="2.2" aria-hidden="true">
        <path d="M12 3 3 8l9 5 9-5-9-5Z" />
        <path d="M6 10v5c0 2 3 4 6 4s6-2 6-4v-5" />
      </svg>
    );
  }

  if (name === 'guard') {
    return (
      <svg className={baseClass} viewBox="0 0 24 24" fill="none" strokeWidth="2.2" aria-hidden="true">
        <path d="M12 3 5 6v6c0 4 3 7 7 9 4-2 7-5 7-9V6l-7-3Z" />
        <path d="M9 12h6" />
      </svg>
    );
  }

  if (name === 'settings') {
    return (
      <svg className={baseClass} viewBox="0 0 24 24" fill="none" strokeWidth="2.2" aria-hidden="true">
        <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" />
        <path d="M4 12h2M18 12h2M12 4v2M12 18v2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M17.7 6.3l-1.4 1.4M7.7 16.3l-1.4 1.4" />
      </svg>
    );
  }

  if (name === 'auth') {
    return (
      <svg className={baseClass} viewBox="0 0 24 24" fill="none" strokeWidth="2.2" aria-hidden="true">
        <path d="M4 4h6v6H4V4ZM14 4h6v6h-6V4ZM4 14h6v6H4v-6Z" />
        <path d="M14 14h2v2h-2v-2ZM18 14h2v6h-6v-2h4v-4ZM14 18h2v2h-2v-2Z" />
      </svg>
    );
  }

  if (name === 'logout') {
    return (
      <svg className={baseClass} viewBox="0 0 24 24" fill="none" strokeWidth="2.2" aria-hidden="true">
        <path d="M10 17 15 12l-5-5" />
        <path d="M15 12H3" />
        <path d="M12 3h7v18h-7" />
      </svg>
    );
  }

  return (
    <svg className={baseClass} viewBox="0 0 24 24" fill="none" strokeWidth="2.2" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.5-4 4.2-6 8-6s6.5 2 8 6" />
    </svg>
  );
}

export function AppChrome({
  displayName,
  roleLabel,
  navItems,
}: AppChromeProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const closeMenu = () => setIsMenuOpen(false);

  const clearBrowserSessionMarkers = () => {
    window.sessionStorage.removeItem('validgate-tab-session');
    window.localStorage.removeItem('validgate-persistent-session');
  };

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto grid h-16 max-w-6xl grid-cols-[48px_minmax(0,1fr)] items-center gap-3 px-4 sm:px-6">
          <div
            className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-slate-900 hover:bg-slate-100"
            title="Menú de navegación"
          >
            <Hamburger
              toggled={isMenuOpen}
              toggle={setIsMenuOpen}
              size={24}
              rounded
              label="Abrir menú de navegación"
            />
          </div>

          <Link href="/dashboard" className="min-w-0 text-center sm:text-left">
            <p className="truncate text-lg font-bold text-slate-900">ValidGateApp</p>
            <p className="hidden text-xs text-slate-500 sm:block">
              Control de ingreso y salida estudiantil
            </p>
          </Link>
        </div>
      </header>

      {isMenuOpen ? (
        <div
          className="fixed inset-0 z-50"
          role="presentation"
          aria-hidden={!isMenuOpen}
        >
          <button
            type="button"
            className="absolute inset-0 h-full w-full bg-slate-950/45"
            onClick={closeMenu}
            aria-label="Cerrar menú de navegación"
          />

          <aside
            id="app-side-menu"
            className="absolute left-0 top-0 z-10 flex h-full w-[min(20rem,82vw)] flex-col border-r border-slate-700 bg-slate-950 text-white shadow-2xl"
            aria-label="Menú lateral"
          >
            <div className="flex items-start justify-between gap-3 border-b border-white/10 p-4">
              <div className="min-w-0">
                <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/30 text-white">
                  <Icon name="profile" />
                </div>
                <p className="break-words text-base font-semibold">{displayName}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-400">
                  {roleLabel}
                </p>
              </div>

              <button
                type="button"
                onClick={closeMenu}
                className="inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg text-white hover:bg-white/10"
                aria-label="Cerrar menú"
              >
                <Icon name="close" />
              </button>
            </div>

            <nav className="flex-1 space-y-1 p-3" aria-label="Opciones de navegación">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeMenu}
                  className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-slate-100 hover:bg-white/10"
                >
                  <Icon name={item.icon} />
                  <span>{item.label}</span>
                </Link>
              ))}
            </nav>

            <div className="space-y-3 border-t border-white/10 p-4">
              <form action={signOutAction} onSubmit={clearBrowserSessionMarkers}>
                <button
                  type="submit"
                  className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium text-slate-100 hover:bg-white/10"
                >
                  <Icon name="logout" />
                  <span>Logout</span>
                </button>
              </form>
              <p className="text-sm font-semibold text-white">ValidGate Version x.x.x</p>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
