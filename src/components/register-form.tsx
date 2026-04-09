'use client';

import Link from 'next/link';
import { useActionState } from 'react';

import { signUpAction } from '@/app/actions/auth';
import { INITIAL_FORM_STATE } from '@/lib/types';

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(signUpAction, INITIAL_FORM_STATE);

  return (
    <form action={formAction} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="first_name" className="mb-2 block text-sm font-medium text-slate-700">
            Nombres
          </label>
          <input id="first_name" name="first_name" className="w-full rounded-xl border border-slate-300 px-4 py-3" />
        </div>
        <div>
          <label htmlFor="last_name" className="mb-2 block text-sm font-medium text-slate-700">
            Apellidos
          </label>
          <input id="last_name" name="last_name" className="w-full rounded-xl border border-slate-300 px-4 py-3" />
        </div>
      </div>

      <div>
        <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-700">
          Email
        </label>
        <input id="email" name="email" type="email" required className="w-full rounded-xl border border-slate-300 px-4 py-3" />
      </div>

      <div>
        <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-700">
          Password
        </label>
        <input id="password" name="password" type="password" required className="w-full rounded-xl border border-slate-300 px-4 py-3" />
      </div>

      {state.message ? <p className="text-sm text-rose-700">{state.message}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-sky-700 px-4 py-3 font-semibold text-white transition hover:bg-sky-800 disabled:opacity-60"
      >
        {pending ? 'Registrando...' : 'Crear cuenta'}
      </button>

      <p className="text-sm text-slate-500">
        ¿Ya tienes cuenta?{' '}
        <Link href="/" className="font-medium text-sky-700 hover:underline">
          Volver al login
        </Link>
      </p>
    </form>
  );
}
