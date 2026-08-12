import {
  confirmGuardianPickupFromForm,
  manuallyValidateGuardianPickupActorFromForm,
  rejectGuardianPickupAtGateFromForm,
  validateGuardianPickupPinFromForm,
  type GuardianPickupRequest,
} from '@/app/actions/guardian-pickups';
import { PendingSubmitButton } from '@/components/pending-submit-button';

const STATUS_LABELS: Record<string, string> = {
  PENDING_STUDENT_RESPONSE: 'Esperando respuesta del estudiante',
  PENDING_GUARD_VALIDATION: 'Listo para validar',
  BOTH_VALIDATED: 'Ambos validados',
  COMPLETED: 'Completado',
  REJECTED_BY_STUDENT: 'Rechazado por el estudiante',
  CANCELLED_BY_GUARDIAN: 'Cancelado por el apoderado',
  EXPIRED: 'Expirado',
  BLOCKED_BY_ATTEMPTS: 'Bloqueado por intentos',
  REJECTED_AT_GATE: 'Rechazado en portería',
};

function ActorValidation({
  request,
  actorType,
}: {
  request: GuardianPickupRequest;
  actorType: 'GUARDIAN' | 'STUDENT';
}) {
  const isGuardian = actorType === 'GUARDIAN';
  const label = isGuardian ? 'Apoderado' : 'Estudiante';
  const method = isGuardian ? request.guardianValidationMethod : request.studentValidationMethod;
  const failedAttempts = isGuardian ? request.guardianFailedAttempts : request.studentFailedAttempts;

  if (method) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
        <p className="text-sm font-semibold text-emerald-800">{label}: validado</p>
        <p className="mt-1 text-xs text-emerald-700">Método: {method === 'PIN' ? 'PIN' : 'Manual controlado'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900">{label}</p>
        <p className="text-xs text-slate-500">Intentos: {failedAttempts}/{request.maxAttempts}</p>
      </div>
      <form action={validateGuardianPickupPinFromForm} className="flex flex-col gap-2 sm:flex-row">
        <input type="hidden" name="request_id" value={request.requestId} />
        <input type="hidden" name="actor_type" value={actorType} />
        <input
          name="pin"
          type="password"
          inputMode="numeric"
          pattern="[0-9]{5}"
          maxLength={5}
          required
          autoComplete="off"
          aria-label={`PIN de ${label.toLowerCase()}`}
          placeholder="PIN de 5 dígitos"
          className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm tracking-[0.25em]"
        />
        <PendingSubmitButton pendingLabel="Validando..." className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
          Validar PIN
        </PendingSubmitButton>
      </form>
      <details className="rounded-xl bg-slate-50 p-3">
        <summary className="cursor-pointer text-sm font-medium text-sky-700">Validación manual controlada</summary>
        <form action={manuallyValidateGuardianPickupActorFromForm} className="mt-3 space-y-2">
          <input type="hidden" name="request_id" value={request.requestId} />
          <input type="hidden" name="actor_type" value={actorType} />
          <select name="reason" required className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
            <option value="">Selecciona el motivo</option>
            <option value="SIN_DISPOSITIVO">Sin dispositivo</option>
            <option value="SIN_BATERIA">Sin batería</option>
            <option value="FALLA_DEL_DISPOSITIVO">Falla del dispositivo</option>
            <option value="PIN_NO_DISPONIBLE">PIN no disponible</option>
            <option value="OTRO">Otro</option>
          </select>
          <textarea name="note" required rows={2} placeholder="Observación obligatoria" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
          <PendingSubmitButton pendingLabel="Registrando..." className="rounded-xl border border-amber-300 px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-50">
            Validar manualmente
          </PendingSubmitButton>
        </form>
      </details>
    </div>
  );
}

export function GuardianPickupQueue({ requests }: { requests: GuardianPickupRequest[] }) {
  const operationalRequests = requests.filter((request) =>
    ['PENDING_STUDENT_RESPONSE', 'PENDING_GUARD_VALIDATION', 'BOTH_VALIDATED'].includes(request.status),
  );
  const recentClosedRequests = requests
    .filter((request) => !['PENDING_STUDENT_RESPONSE', 'PENDING_GUARD_VALIDATION', 'BOTH_VALIDATED'].includes(request.status))
    .slice(0, 5);

  return (
    <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">Retiros con validación dual</h2>
        <p className="mt-1 text-sm text-slate-500">Cola institucional actualizada automáticamente. Portería confirma únicamente la salida efectiva.</p>
      </div>

      {operationalRequests.length ? (
        <div className="space-y-4">
          {operationalRequests.map((request) => {
            const readyForValidation = request.status !== 'PENDING_STUDENT_RESPONSE';
            return (
              <article key={request.requestId} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{request.studentName}</p>
                    <p className="mt-1 text-sm text-slate-500">Retira: {request.guardianName}</p>
                    <p className="mt-1 text-xs text-slate-400">Solicitado {new Date(request.createdAt).toLocaleString('es-CL')}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${request.status === 'BOTH_VALIDATED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                    {STATUS_LABELS[request.status] ?? request.status}
                  </span>
                </div>

                {request.expiresAt ? (
                  <p className="mt-3 text-xs font-medium text-slate-500">PIN vigentes hasta {new Date(request.expiresAt).toLocaleTimeString('es-CL')}</p>
                ) : null}

                {readyForValidation ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <ActorValidation request={request} actorType="GUARDIAN" />
                    <ActorValidation request={request} actorType="STUDENT" />
                  </div>
                ) : (
                  <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">El estudiante aún no responde. No se han generado PIN.</p>
                )}

                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  {request.status === 'BOTH_VALIDATED' ? (
                    <form action={confirmGuardianPickupFromForm}>
                      <input type="hidden" name="request_id" value={request.requestId} />
                      <PendingSubmitButton pendingLabel="Confirmando..." className="w-full rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 sm:w-auto">
                        Confirmar retiro efectivo
                      </PendingSubmitButton>
                    </form>
                  ) : null}
                  {readyForValidation ? (
                    <details className="rounded-xl border border-rose-200 px-3 py-2">
                      <summary className="cursor-pointer text-sm font-semibold text-rose-700">Rechazar en portería</summary>
                      <form action={rejectGuardianPickupAtGateFromForm} className="mt-3 w-full space-y-2 sm:w-80">
                        <input type="hidden" name="request_id" value={request.requestId} />
                        <select name="reason" required className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
                          <option value="">Selecciona el motivo</option>
                          <option value="IDENTIDAD_NO_COINCIDE">Identidad no coincide</option>
                          <option value="VINCULO_NO_AUTORIZADO">Vínculo no autorizado</option>
                          <option value="INSTRUCCION_ADMINISTRATIVA">Instrucción administrativa</option>
                          <option value="OTRO">Otro</option>
                        </select>
                        <textarea name="note" required rows={2} placeholder="Observación obligatoria" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                        <PendingSubmitButton pendingLabel="Rechazando..." className="rounded-xl bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800">
                          Confirmar rechazo
                        </PendingSubmitButton>
                      </form>
                    </details>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">No hay retiros activos en la cola.</p>
      )}

      {recentClosedRequests.length ? (
        <details className="rounded-2xl border border-slate-200 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-slate-700">Retiros finalizados recientemente</summary>
          <div className="mt-3 divide-y divide-slate-100">
            {recentClosedRequests.map((request) => (
              <div key={request.requestId} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <div>
                  <p className="font-medium text-slate-900">{request.studentName}</p>
                  <p className="text-slate-500">{request.guardianName}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-slate-700">{STATUS_LABELS[request.status] ?? request.status}</p>
                  <p className="text-xs text-slate-400">{new Date(request.updatedAt).toLocaleString('es-CL')}</p>
                </div>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}
