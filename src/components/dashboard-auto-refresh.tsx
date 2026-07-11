'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

type DashboardAutoRefreshProps = {
  expiresAt: Array<string | null | undefined>;
};

export function DashboardAutoRefresh({ expiresAt }: DashboardAutoRefreshProps) {
  const router = useRouter();
  const refreshKey = expiresAt.filter(Boolean).join('|');

  useEffect(() => {
    const expirationTimes = expiresAt
      .map((value) => (value ? new Date(value).getTime() : Number.NaN))
      .filter((value) => Number.isFinite(value));

    if (expirationTimes.length === 0) return;

    const nextExpiration = Math.min(...expirationTimes);
    const delay = Math.max(nextExpiration - Date.now() + 1000, 0);
    const timerId = window.setTimeout(() => {
      router.refresh();
    }, delay);

    const refreshIfExpired = () => {
      if (document.visibilityState === 'visible' && nextExpiration <= Date.now()) {
        router.refresh();
      }
    };

    document.addEventListener('visibilitychange', refreshIfExpired);

    return () => {
      window.clearTimeout(timerId);
      document.removeEventListener('visibilitychange', refreshIfExpired);
    };
  }, [router, refreshKey]);

  return null;
}
