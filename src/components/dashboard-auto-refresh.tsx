'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { createClient } from '@/lib/supabase/client';

type DashboardAutoRefreshProps = {
  expiresAt: Array<string | null | undefined>;
};

export function DashboardAutoRefresh({ expiresAt }: DashboardAutoRefreshProps) {
  const router = useRouter();
  const refreshKey = expiresAt.filter(Boolean).join('|');

  useEffect(() => {
    const supabase = createClient();
    const refreshDashboard = () => router.refresh();
    const expirationTimes = expiresAt
      .map((value) => (value ? new Date(value).getTime() : Number.NaN))
      .filter((value) => Number.isFinite(value));

    const nextExpiration = expirationTimes.length > 0 ? Math.min(...expirationTimes) : null;
    const expirationTimerId = nextExpiration === null
      ? null
      : window.setTimeout(
          refreshDashboard,
          Math.max(nextExpiration - Date.now() + 1000, 0),
        );

    const realtimeChannel = supabase
      .channel('dashboard-state-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'authorization_requests' },
        refreshDashboard,
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'students' },
        refreshDashboard,
      )
      .subscribe();

    // Respaldo para entornos donde Realtime no esté disponible temporalmente.
    const fallbackIntervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') refreshDashboard();
    }, 15_000);

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refreshDashboard();
    };

    document.addEventListener('visibilitychange', refreshWhenVisible);
    window.addEventListener('focus', refreshDashboard);

    return () => {
      if (expirationTimerId !== null) window.clearTimeout(expirationTimerId);
      window.clearInterval(fallbackIntervalId);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      window.removeEventListener('focus', refreshDashboard);
      void supabase.removeChannel(realtimeChannel);
    };
  }, [router, refreshKey]);

  return null;
}
