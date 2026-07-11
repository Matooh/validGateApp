'use client';

import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';

type ToastTone = 'success' | 'warning' | 'danger' | 'info';

const TONE_STYLES: Record<ToastTone, { wrapper: string; title: string }> = {
  success: {
    wrapper: 'border-emerald-200 bg-emerald-50 text-emerald-900 shadow-emerald-100',
    title: 'Éxito',
  },
  warning: {
    wrapper: 'border-amber-200 bg-amber-50 text-amber-900 shadow-amber-100',
    title: 'Atención',
  },
  danger: {
    wrapper: 'border-rose-200 bg-rose-50 text-rose-900 shadow-rose-100',
    title: 'Error',
  },
  info: {
    wrapper: 'border-sky-200 bg-sky-50 text-sky-900 shadow-sky-100',
    title: 'Info',
  },
};

type FeedbackToastProps = {
  message: string | null | undefined;
  tone?: ToastTone;
  title?: string;
  placementClassName?: string;
};

export function FeedbackToast({
  message,
  tone = 'info',
  title,
  placementClassName = 'fixed z-50 w-[min(92vw,26rem)]',
}: FeedbackToastProps) {
  const [open, setOpen] = useState(Boolean(message));
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setOpen(Boolean(message));
  }, [message]);

  useEffect(() => {
    if (!open || !message) return;

    const timerId = window.setTimeout(() => setOpen(false), 3800);
    return () => window.clearTimeout(timerId);
  }, [open, message]);

  if (!message || !open) return null;

  if (!mounted) return null;

  const theme = TONE_STYLES[tone];

  return createPortal(
    <div
      className={`${placementClassName} rounded-2xl border px-4 py-3 shadow-lg ${theme.wrapper}`}
      style={{
        left: '50%',
        bottom: 'calc(2rem + env(safe-area-inset-bottom))',
        transform: 'translateX(-50%)',
      }}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] opacity-70">
            {title ?? theme.title}
          </p>
          <p className="mt-1 text-sm font-medium leading-5">{message}</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-full px-2 py-1 text-xs font-semibold opacity-70 transition hover:opacity-100"
          aria-label="Cerrar notificación"
        >
          Cerrar
        </button>
      </div>
    </div>,
    document.body,
  );
}
