'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

import newBadgeIcon from '../../assets/icons/new.png';

type RecentEventCardProps = {
  eventId: string;
  children: ReactNode;
  showNewBadge?: boolean;
  storageScope?: string;
};

const STORAGE_PREFIX = 'validgate:recent-event-viewed:';

export function RecentEventCard({
  eventId,
  children,
  showNewBadge = true,
  storageScope = 'global',
}: RecentEventCardProps) {
  const storageKey = `${STORAGE_PREFIX}${storageScope}:${eventId}`;
  const [isViewed, setIsViewed] = useState(true);

  useEffect(() => {
    setIsViewed(window.localStorage.getItem(storageKey) === '1');
  }, [storageKey]);

  function markAsViewed() {
    if (isViewed) return;

    window.localStorage.setItem(storageKey, '1');
    setIsViewed(true);
  }

  const shouldShowNewBadge = showNewBadge && !isViewed;

  return (
    <article
      className="relative min-w-0 overflow-hidden rounded-2xl border border-slate-200 p-4"
      onClick={markAsViewed}
      onFocus={markAsViewed}
      onMouseEnter={markAsViewed}
    >
      {shouldShowNewBadge ? (
        <img
          src={newBadgeIcon.src}
          alt=""
          aria-hidden="true"
          draggable={false}
          className="pointer-events-none absolute right-0 top-0 z-10 h-10 w-10 select-none object-contain sm:h-11 sm:w-11"
        />
      ) : null}
      {children}
    </article>
  );
}
