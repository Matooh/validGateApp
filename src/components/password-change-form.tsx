'use client';

import { useActionState, useEffect, useRef } from 'react';

import { updatePasswordAction, type PasswordChangeState } from '@/app/actions/auth';
import { FeedbackToast } from '@/components/feedback-toast';

type FieldProps = {
  id: string;
  name: string;
  label: string;
  autoComplete: string;
  error?: string;
};

function PasswordField({ id, name, label, autoComplete, error }: FieldProps) {
  const errorId = `${id}-error`;
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-medium text-slate-700">{label}</label>
      <input id={id} name={name} type="password" required autoComplete={autoComplete} minLength={6} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} className={`w-full rounded-xl border px-4 py-3 outline-none transition focus:border-sky-500 ${error ? 'border-rose-400' : 'border-slate-300'}`} />
      {error ? <p id={errorId} className="mt-1 text-sm text-rose-700">{error}</p> : null}
    </div>
  );
}

export function PasswordChangeForm() {
  const initialState: PasswordChangeState = { success: false, message: '', fieldErrors: {} };
  const [state, action, pending] = useActionState(updatePasswordAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <form ref={formRef} action={action} className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm" noValidate>
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Cambiar contraseña</h2>
        <p className="mt-1 text-sm text-slate-500">Confirma tu contraseña actual antes de definir una nueva.</p>
      </div>
      <PasswordField id="current-password" name="current_password" label="Contraseña actual" autoComplete="current-password" error={state.fieldErrors.currentPassword} />
      <PasswordField id="new-password" name="new_password" label="Nueva contraseña" autoComplete="new-password" error={state.fieldErrors.newPassword} />
      <PasswordField id="confirm-password" name="confirm_password" label="Repetir nueva contraseña" autoComplete="new-password" error={state.fieldErrors.confirmPassword} />
      {!state.success && state.message && !Object.keys(state.fieldErrors).length ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.message}</p> : null}
      <FeedbackToast message={state.success ? state.message : null} tone="success" title="Seguridad" />
      <button type="submit" disabled={pending} className="rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400">
        {pending ? 'Cambiando contraseña...' : 'Cambiar contraseña'}
      </button>
    </form>
  );
}
