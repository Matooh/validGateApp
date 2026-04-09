'use client';

import Link from 'next/link';
import { useActionState, useEffect, useState } from 'react';

import { signInAction } from '@/app/actions/auth';
import { INITIAL_FORM_STATE } from '@/lib/types';

export function LoginForm() {
  const [state, formAction, pending] = useActionState(signInAction, INITIAL_FORM_STATE);
  const [rememberMe, setRememberMe] = useState(false);
  const [email, setEmail] = useState('');

  useEffect(() => {
    const savedEmail = window.localStorage.getItem('validgate-remembered-email');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  function handleSubmit() {
    if (rememberMe && email) {
      window.localStorage.setItem('validgate-remembered-email', email);
      return;
    }

    window.localStorage.removeItem('validgate-remembered-email');
  }

  return (
    <form action={formAction} onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-700">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-sky-500"
          placeholder="apoderado@validgate.app"
        />
      </div>

      <div>
        <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-700">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-sky-500"
          placeholder="******"
        />
      </div>

      <div className="flex items-center justify-between gap-3 text-sm">
        <label className="flex items-center gap-2 text-slate-600">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(event) => setRememberMe(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          remember me
        </label>

        <Link href="/register" className="font-medium text-sky-700 hover:underline">
          registrarse
        </Link>
      </div>

      {state.message ? <p className="text-sm text-rose-700">{state.message}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-sky-700 px-4 py-3 font-semibold text-white transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? 'Ingresando...' : 'Login'}
      </button>
    </form>
  );
}
