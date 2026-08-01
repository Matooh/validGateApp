'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { createClient } from '@/lib/supabase/client';

const PUBLIC_ROUTES = new Set(['/', '/register', '/auth/callback']);

export function ProtectedSessionGuard() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [checking, setChecking] = useState(!PUBLIC_ROUTES.has(pathname));

  useEffect(() => {
    if (PUBLIC_ROUTES.has(pathname)) {
      setChecking(false);
      return;
    }

    const initializedByCallback = searchParams.has('session_init');
    const hasTabSession = window.sessionStorage.getItem('validgate-tab-session') === 'active';
    const hasPersistentSession =
      window.localStorage.getItem('validgate-persistent-session') === 'active';

    if (initializedByCallback) {
      window.sessionStorage.setItem('validgate-tab-session', 'active');
      setChecking(false);
      router.replace(pathname);
      return;
    }

    if (hasTabSession || hasPersistentSession) {
      setChecking(false);
      return;
    }

    const rejectSharedBrowserSession = async () => {
      const supabase = createClient();
      await supabase.auth.signOut({ scope: 'local' });
      window.location.replace('/');
    };

    void rejectSharedBrowserSession();
  }, [pathname, router, searchParams]);

  if (!checking) return null;

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-slate-50"
      role="status"
      aria-live="polite"
    >
      <p className="text-sm font-medium text-slate-600">Validando sesión...</p>
    </div>
  );
}
