'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import QRCode from 'react-qr-code';

import { createStudentQrCredential } from '@/app/actions/qr-credentials';
import { QR_MESSAGE_TEXT, type QrMessageCode } from '@/lib/messages/qr-messages';

type AuthenticationQrCardProps = {
  title: string;
  subtitle: string;
  studentId?: number;
  initialCredentialId?: string | null;
  initialExpiresAt?: string | null;
  canLeaveAlone?: boolean | null;
  isInInstitution?: boolean | null;
  unavailableMessageCode?: QrMessageCode;
};

export function AuthenticationQrCard({
  title,
  subtitle,
  studentId,
  initialCredentialId = null,
  initialExpiresAt = null,
  canLeaveAlone = null,
  isInInstitution = null,
  unavailableMessageCode = 'STUDENT_PROFILE_NOT_LINKED',
}: AuthenticationQrCardProps) {
  const [qrPayload, setQrPayload] = useState<string | null>(
    initialCredentialId ? `validgate-auth:${initialCredentialId}` : null,
  );
  const [expiresAt, setExpiresAt] = useState<string | null>(initialExpiresAt);
  const [messageCode, setMessageCode] = useState<QrMessageCode>(
    initialCredentialId && initialExpiresAt ? 'QR_VALID' : 'QR_NOT_ACTIVE',
  );
  const [now, setNow] = useState(() => Date.now());
  const [isPending, startTransition] = useTransition();

  const secondsRemaining = useMemo(() => {
    if (!expiresAt) return 0;
    return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / 1000));
  }, [expiresAt, now]);

  const isExpired = Boolean(expiresAt) && secondsRemaining <= 0;
  const canGenerate = typeof studentId === 'number' && !(canLeaveAlone === false && isInInstitution === true);

  const generateCredential = () => {
    if (!canGenerate) {
      setMessageCode(unavailableMessageCode);
      return;
    }

    startTransition(async () => {
      const result = await createStudentQrCredential(studentId);

      if (!result.success || !result.qrPayload || !result.expiresAt) {
        setQrPayload(null);
        setExpiresAt(null);
        setMessageCode(result.messageCode);
        return;
      }

      setQrPayload(result.qrPayload);
      setExpiresAt(result.expiresAt);
      setMessageCode(result.messageCode);
      setNow(Date.now());
    });
  };

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    setQrPayload(initialCredentialId ? `validgate-auth:${initialCredentialId}` : null);
    setExpiresAt(initialExpiresAt);
    setMessageCode(initialCredentialId && initialExpiresAt ? 'QR_VALID' : 'QR_NOT_ACTIVE');
    setNow(Date.now());
  }, [initialCredentialId, initialExpiresAt]);

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          <p className="mt-3 text-xs font-medium text-slate-400">
            Token opaco temporal, sin datos personales en texto plano.
          </p>
          <p className="mt-2 text-sm text-slate-600">
            {isExpired ? QR_MESSAGE_TEXT.QR_EXPIRED : QR_MESSAGE_TEXT[messageCode]}
          </p>
          {expiresAt && !isExpired ? (
            <p className="mt-1 text-xs font-semibold text-sky-700">
              Expira en {secondsRemaining}s
            </p>
          ) : null}
          {!canGenerate ? (
            <p className="mt-2 text-xs text-amber-700">
              {canLeaveAlone === false && isInInstitution === true
                ? 'No se puede generar un QR de salida mientras el estudiante esté dentro. El retiro requiere autorización y PIN dual.'
                : QR_MESSAGE_TEXT[unavailableMessageCode]}
            </p>
          ) : null}
          <button
            type="button"
            onClick={generateCredential}
            disabled={isPending || !canGenerate}
            className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {isPending ? 'Generando QR...' : qrPayload && !isExpired ? 'Generar nuevo QR' : 'Generar QR'}
          </button>
        </div>

        <div className="flex h-36 w-36 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white p-3">
          {qrPayload && !isExpired ? (
            <QRCode value={qrPayload} size={112} />
          ) : (
            <span className="text-center text-xs font-medium text-slate-400">
              QR no disponible
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
