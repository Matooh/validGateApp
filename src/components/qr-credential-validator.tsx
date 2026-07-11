'use client';

import { useState, useTransition } from 'react';

import {
  confirmStudentQrAccessEvent,
  validateStudentQrCredential,
} from '@/app/actions/qr-credentials';
import { QR_MESSAGE_TEXT, type QrMessageCode } from '@/lib/messages/qr-messages';
import type { QrAccessEventType, StudentQrValidationResult } from '@/lib/types';

const INITIAL_VALIDATION: StudentQrValidationResult = {
  credentialId: null,
  studentId: null,
  firstName: null,
  lastName: null,
  courseName: null,
  canLeaveAlone: null,
  hasValidExitAuthorization: null,
  exitAuthorizationValidUntil: null,
  isInInstitution: null,
  institutionId: null,
  validationStatus: 'INVALID',
  messageCode: 'QR_NOT_ACTIVE',
};

export function QrCredentialValidator() {
  const [payload, setPayload] = useState('');
  const [validation, setValidation] = useState<StudentQrValidationResult>(INITIAL_VALIDATION);
  const [messageCode, setMessageCode] = useState<QrMessageCode>('QR_NOT_ACTIVE');
  const [messageDismissed, setMessageDismissed] = useState(false);
  const [isPending, startTransition] = useTransition();

  const validatePayload = () => {
    startTransition(async () => {
      const result = await validateStudentQrCredential(payload);
      setValidation(result);
      setMessageCode(result.messageCode);
      setMessageDismissed(false);
    });
  };

  const confirmEvent = (eventType: QrAccessEventType) => {
    const credentialId = validation.credentialId;
    if (!credentialId) return;

    startTransition(async () => {
      const result = await confirmStudentQrAccessEvent({
        credentialId,
        eventType,
      });

      setMessageCode(result.messageCode as QrMessageCode);
      setMessageDismissed(false);

      if (result.success) {
        setMessageCode(eventType === 'SALIDA' ? 'ACCESS_EXIT_REGISTERED' : 'QR_EVENT_REGISTERED');
        setPayload('');
        setValidation(INITIAL_VALIDATION);
      }
    });
  };

  const isValid = validation.validationStatus === 'VALID' && Boolean(validation.credentialId);
  const canConfirmEntry = isValid && validation.isInInstitution === false;
  const canConfirmExit =
    isValid &&
    validation.isInInstitution === true &&
    (validation.canLeaveAlone === true || validation.hasValidExitAuthorization === true);
  const canConfirmWithdrawal =
    isValid &&
    validation.isInInstitution === true &&
    (validation.canLeaveAlone === true || validation.hasValidExitAuthorization === true);

  return (
    <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">
          Validación QR
        </h2>
        <p className="text-sm text-slate-500">
          Escanea o pega la credencial opaca del estudiante.
        </p>
      </div>

      <div className="space-y-3">
        <label htmlFor="qr_payload" className="block text-sm font-medium text-slate-700">
          Payload QR
        </label>
        <textarea
          id="qr_payload"
          value={payload}
          onChange={(event) => setPayload(event.target.value)}
          rows={3}
          placeholder="validgate-auth:00000000-0000-0000-0000-000000000000"
          className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
        />
        <button
          type="button"
          onClick={validatePayload}
          disabled={isPending || !payload.trim()}
          className="rounded-xl bg-sky-700 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          Validar QR
        </button>
      </div>

      {!messageDismissed ? (
        <div
          className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
            isValid
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-amber-200 bg-amber-50 text-amber-800'
          }`}
          role="status"
        >
          <p className="min-w-0 break-words">{QR_MESSAGE_TEXT[messageCode]}</p>
          <button
            type="button"
            onClick={() => setMessageDismissed(true)}
            aria-label="Cerrar mensaje"
            className="shrink-0 rounded-md px-2 text-base font-semibold leading-none hover:bg-black/5"
          >
            x
          </button>
        </div>
      ) : null}

      {isValid ? (
        <article className="rounded-2xl border border-slate-200 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-slate-900">
                {validation.firstName} {validation.lastName}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Curso: {validation.courseName ?? 'Sin curso asignado'}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Estado: {validation.isInInstitution ? 'Dentro del establecimiento' : 'Fuera del establecimiento'}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Salida solo: {validation.canLeaveAlone ? 'Permitida' : 'No permitida'}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Autorización vigente:{' '}
                {validation.hasValidExitAuthorization
                  ? `Sí, hasta ${new Date(validation.exitAuthorizationValidUntil ?? '').toLocaleTimeString('es-CL', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}`
                  : 'No'}
              </p>
              {validation.isInInstitution === false ? (
                <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  {QR_MESSAGE_TEXT.QR_STUDENT_NOT_INSIDE}
                </p>
              ) : null}
              {validation.canLeaveAlone === false && !validation.hasValidExitAuthorization ? (
                <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  {QR_MESSAGE_TEXT.QR_EXIT_NOT_ALLOWED_ALONE}
                </p>
              ) : null}
            </div>
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
              QR válido
            </span>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={() => confirmEvent('INGRESO')}
              disabled={isPending || !canConfirmEntry}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              Confirmar ingreso
            </button>
            <button
              type="button"
              onClick={() => confirmEvent('SALIDA')}
              disabled={isPending || !canConfirmExit}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Confirmar salida
            </button>
            <button
              type="button"
              onClick={() => confirmEvent('RETIRO')}
              disabled={isPending || !canConfirmWithdrawal}
              className="rounded-xl border border-sky-300 px-4 py-2 text-sm font-semibold text-sky-700 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Confirmar retiro
            </button>
            <button
              type="button"
              onClick={() => {
                setPayload('');
                setValidation(INITIAL_VALIDATION);
                setMessageCode('QR_NOT_ACTIVE');
                setMessageDismissed(false);
              }}
              className="rounded-xl border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50"
            >
              Cancelar
            </button>
          </div>
        </article>
      ) : null}
    </section>
  );
}
