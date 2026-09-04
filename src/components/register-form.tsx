'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useActionState } from 'react';

import { signUpAction } from '@/app/actions/auth';
import { formatRut, isValidRut } from '@/lib/chile/rut';
import { MIN_PASSWORD_LENGTH } from '@/lib/password';
import { INITIAL_FORM_STATE } from '@/lib/types';

type InstitutionOption = { id: number; name: string };

export function RegisterForm({ institutions }: { institutions: InstitutionOption[] }) {
  const [state, formAction, pending] = useActionState(signUpAction, INITIAL_FORM_STATE);
  const [values, setValues] = useState({
    first_name: '',
    last_name: '',
    email: '',
    rut: '',
    password: '',
    confirm_password: '',
    institution_id: '',
  });
  const [touched, setTouched] = useState<Record<keyof typeof values, boolean>>({
    first_name: false,
    last_name: false,
    email: false,
    rut: false,
    password: false,
    confirm_password: false,
    institution_id: false,
  });

  useEffect(() => {
    if (!state.formValues) return;
    setValues((current) => ({ ...current, ...state.formValues }));
  }, [state.formValues]);

  const errors = useMemo(() => ({
    first_name: values.first_name.trim() ? '' : 'Los nombres son obligatorios.',
    last_name: values.last_name.trim() ? '' : 'Los apellidos son obligatorios.',
    email: !values.email.trim()
      ? 'El correo electrónico es obligatorio.'
      : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())
        ? ''
        : 'Ingresa un correo electrónico válido.',
    password: !values.password ? 'La contraseña es obligatoria.' : values.password.length < MIN_PASSWORD_LENGTH ? `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.` : '',
    rut: !values.rut.trim() ? 'El RUT es obligatorio.' : isValidRut(values.rut) ? '' : 'Ingresa un RUT chileno válido.',
    confirm_password: !values.confirm_password
      ? 'Debes repetir la contraseña.'
      : values.password !== values.confirm_password
        ? 'Las contraseñas no coinciden.'
        : '',
    institution_id: values.institution_id ? '' : 'Selecciona una institución.',
  }), [values]);

  const updateField = (field: keyof typeof values, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
  };

  const markTouched = (field: keyof typeof values) => {
    setTouched((current) => ({ ...current, [field]: true }));
  };

  const hasErrors = Object.values(errors).some(Boolean);

  return (
    <form action={formAction} noValidate onSubmit={(event) => {
      if (hasErrors) {
        event.preventDefault();
        setTouched({
          first_name: true,
          last_name: true,
          email: true,
          password: true,
          confirm_password: true,
          rut: true,
          institution_id: true,
        });
      }
    }} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="first_name" className="mb-2 block text-sm font-medium text-slate-700">
            Nombres
          </label>
          <input id="first_name" name="first_name" value={values.first_name} onChange={(event) => updateField('first_name', event.target.value)} onBlur={() => markTouched('first_name')} aria-invalid={Boolean(touched.first_name && errors.first_name)} aria-describedby={touched.first_name && errors.first_name ? 'first_name-error' : undefined} className={`w-full rounded-xl border px-4 py-3 ${touched.first_name && errors.first_name ? 'border-rose-400' : 'border-slate-300'}`} />
          {touched.first_name && errors.first_name ? <p id="first_name-error" className="mt-1 text-sm text-rose-700">{errors.first_name}</p> : null}
        </div>
        <div>
          <label htmlFor="last_name" className="mb-2 block text-sm font-medium text-slate-700">
            Apellidos
          </label>
          <input id="last_name" name="last_name" value={values.last_name} onChange={(event) => updateField('last_name', event.target.value)} onBlur={() => markTouched('last_name')} aria-invalid={Boolean(touched.last_name && errors.last_name)} aria-describedby={touched.last_name && errors.last_name ? 'last_name-error' : undefined} className={`w-full rounded-xl border px-4 py-3 ${touched.last_name && errors.last_name ? 'border-rose-400' : 'border-slate-300'}`} />
          {touched.last_name && errors.last_name ? <p id="last_name-error" className="mt-1 text-sm text-rose-700">{errors.last_name}</p> : null}
        </div>
      </div>

      <div>
        <label htmlFor="institution_id" className="mb-2 block text-sm font-medium text-slate-700">Institución</label>
        <select id="institution_id" name="institution_id" value={values.institution_id} onChange={(event) => updateField('institution_id', event.target.value)} onBlur={() => markTouched('institution_id')} aria-invalid={Boolean(touched.institution_id && errors.institution_id)} className={`w-full rounded-xl border bg-white px-4 py-3 ${touched.institution_id && errors.institution_id ? 'border-rose-400' : 'border-slate-300'}`}>
          <option value="">Selecciona tu institución</option>
          {institutions.map((institution) => <option key={institution.id} value={institution.id}>{institution.name}</option>)}
        </select>
        {touched.institution_id && errors.institution_id ? <p className="mt-1 text-sm text-rose-700">{errors.institution_id}</p> : null}
      </div>

      <div>
        <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-700">
          Correo electrónico
        </label>
        <input id="email" name="email" type="email" value={values.email} onChange={(event) => updateField('email', event.target.value)} onBlur={() => markTouched('email')} aria-invalid={Boolean(touched.email && errors.email)} aria-describedby={touched.email && errors.email ? 'email-error' : undefined} className={`w-full rounded-xl border px-4 py-3 ${touched.email && errors.email ? 'border-rose-400' : 'border-slate-300'}`} />
        {touched.email && errors.email ? <p id="email-error" className="mt-1 text-sm text-rose-700">{errors.email}</p> : null}
      </div>

      <div>
        <label htmlFor="rut" className="mb-2 block text-sm font-medium text-slate-700">RUT</label>
        <input id="rut" name="rut" value={values.rut} placeholder="12345678-5" autoComplete="off" onChange={(event) => updateField('rut', formatRut(event.target.value))} onBlur={() => markTouched('rut')} aria-invalid={Boolean(touched.rut && errors.rut)} aria-describedby={touched.rut && errors.rut ? 'rut-error' : undefined} className={`w-full rounded-xl border px-4 py-3 ${touched.rut && errors.rut ? 'border-rose-400' : 'border-slate-300'}`} />
        {touched.rut && errors.rut ? <p id="rut-error" className="mt-1 text-sm text-rose-700">{errors.rut}</p> : null}
      </div>

      <div>
        <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-700">
          Contraseña
        </label>
        <input id="password" name="password" type="password" minLength={MIN_PASSWORD_LENGTH} value={values.password} onChange={(event) => updateField('password', event.target.value)} onBlur={() => markTouched('password')} aria-invalid={Boolean(touched.password && errors.password)} aria-describedby={touched.password && errors.password ? 'password-error' : undefined} className={`w-full rounded-xl border px-4 py-3 ${touched.password && errors.password ? 'border-rose-400' : 'border-slate-300'}`} />
        {touched.password && errors.password ? <p id="password-error" className="mt-1 text-sm text-rose-700">{errors.password}</p> : null}
      </div>

      <div>
        <label htmlFor="confirm_password" className="mb-2 block text-sm font-medium text-slate-700">Repetir contraseña</label>
        <input id="confirm_password" name="confirm_password" type="password" minLength={MIN_PASSWORD_LENGTH} value={values.confirm_password} onChange={(event) => updateField('confirm_password', event.target.value)} onBlur={() => markTouched('confirm_password')} aria-invalid={Boolean(touched.confirm_password && errors.confirm_password)} aria-describedby={touched.confirm_password && errors.confirm_password ? 'confirm_password-error' : undefined} className={`w-full rounded-xl border px-4 py-3 ${touched.confirm_password && errors.confirm_password ? 'border-rose-400' : 'border-slate-300'}`} />
        {touched.confirm_password && errors.confirm_password ? <p id="confirm_password-error" className="mt-1 text-sm text-rose-700">{errors.confirm_password}</p> : null}
      </div>

      {state.message ? <p className="text-sm text-rose-700">{state.message}</p> : null}

      <button
        type="submit"
        disabled={pending || hasErrors}
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
