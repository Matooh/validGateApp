'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  getMyActivePickupCredentials,
  type GuardianPickupRequest,
  type MyPickupPin,
} from '@/app/actions/guardian-pickups';
import { createClient } from '@/lib/supabase/client';

type GuardianPickupLiveStatusProps = {
  role: string | null | undefined;
  canLeaveAlone: boolean | null | undefined;
  initialRequests: GuardianPickupRequest[];
  initialPins: MyPickupPin[];
};

const ACTIVE_STATUSES = new Set([
  'PENDING_STUDENT_RESPONSE',
  'PENDING_GUARD_VALIDATION',
  'BOTH_VALIDATED',
]);

export function GuardianPickupLiveStatus({
  role,
  canLeaveAlone,
  initialRequests,
  initialPins,
}: GuardianPickupLiveStatusProps) {
  const [requests, setRequests] = useState(initialRequests);
  const [pins, setPins] = useState(initialPins);
  const isRefreshingRef = useRef(false);

  const refresh = useCallback(async () => {
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    try {
      const next = await getMyActivePickupCredentials();
      setRequests(next.requests);
      setPins(next.pins);
    } finally {
      isRefreshingRef.current = false;
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('authentications-pickup-state')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'guardian_pickup_requests' },
        refresh,
      )
      .subscribe();

    const fallbackIntervalId = window.setInterval(refresh, 15_000);

    return () => {
      window.clearInterval(fallbackIntervalId);
      void supabase.removeChannel(channel);
    };
  }, [refresh]);

  const activeRequests = useMemo(
    () => requests.filter((request) => ACTIVE_STATUSES.has(request.status)),
    [requests],
  );
  const pinByRequestId = useMemo(
    () => new Map(pins.map((pin) => [pin.requestId, pin])),
    [pins],
  );

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Credenciales PIN DUAL</h2>
        <p className="mt-1 text-sm text-slate-500">
          Los PIN se generan cuando el responsable inicia el retiro y el estudiante acepta la solicitud.
        </p>
      </div>

      {activeRequests.length > 0 ? (
        <div className="space-y-4">
          {activeRequests.map((request) => {
            const pin = pinByRequestId.get(request.requestId);
            const actorLabel = role === 'ESTUDIANTE' ? 'estudiante' : 'responsable';

            return (
              <article key={request.requestId} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold text-slate-900">{request.studentName}</p>
                    <p className="mt-1 text-sm text-slate-500">Retiro solicitado por {request.guardianName}.</p>
                  </div>
                  <span className="w-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                    {request.status === 'PENDING_STUDENT_RESPONSE'
                      ? 'Esperando aceptación'
                      : request.status === 'BOTH_VALIDATED'
                        ? 'Identidades validadas'
                        : 'Pendiente en portería'}
                  </span>
                </div>

                {pin ? (
                  <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-center">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">Tu PIN de {actorLabel}</p>
                    <p className="mt-2 font-mono text-3xl font-bold tracking-[0.35em] text-slate-900">{pin.pin}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      Válido hasta {new Date(pin.expiresAt).toLocaleTimeString('es-CL')}. Preséntalo solo en portería.
                    </p>
                  </div>
                ) : (
                  <div className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    {request.status === 'PENDING_STUDENT_RESPONSE'
                      ? role === 'ESTUDIANTE'
                        ? 'Debes aceptar la solicitud antes de que se genere el PIN DUAL.'
                        : 'El PIN se generará cuando el estudiante acepte la solicitud.'
                      : 'Tu identidad ya fue validada y el PIN dejó de estar disponible.'}
                  </div>
                )}

                {request.status === 'PENDING_STUDENT_RESPONSE' && role === 'ESTUDIANTE' ? (
                  <Link
                    href="/dashboard"
                    className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
                  >
                    Revisar y aceptar solicitud
                  </Link>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
          {role === 'ESTUDIANTE' && canLeaveAlone === false
            ? 'No puedes salir sin autorización. Para obtener el PIN DUAL, tu responsable debe iniciar un retiro y tú debes aceptar la solicitud.'
            : 'No hay un retiro activo con PIN DUAL.'}
        </div>
      )}
    </section>
  );
}
