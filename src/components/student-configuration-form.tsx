'use client';

import { useState } from 'react';
import { updateStudentAction } from '@/app/actions/students';
import { PendingSubmitButton } from '@/components/pending-submit-button';
import { formatRut, isValidRut } from '@/lib/chile/rut';
import { isValidChileMobilePhone } from '@/lib/chile/phone';

export function StudentConfigurationForm({ student }: { student: { id: number; rut: string | null; phone: string | null; can_leave_alone: boolean } }) {
  const storedChilePhone = /^\+56(9\d{8})$/.exec(student.phone ?? '');
  const [rut, setRut] = useState(student.rut ?? '');
  const [countryCode, setCountryCode] = useState('+56');
  const [phone, setPhone] = useState(storedChilePhone ? storedChilePhone[1] : (student.phone ?? '').replace(/^\+56/, ''));
  const [touched, setTouched] = useState({ rut: false, phone: false });
  const rutInvalid = rut.length > 0 && !isValidRut(rut);
  const phoneInvalid = phone.length > 0 && !isValidChileMobilePhone(`${countryCode}${phone}`);
  const mark = (field: 'rut' | 'phone') => setTouched((current) => ({ ...current, [field]: true }));

  return (
    <form action={updateStudentAction} className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-slate-900">Configuración del estudiante</h2>
      <input type="hidden" name="student_id" value={student.id} />
      <div>
        <label htmlFor="validated-rut" className="mb-2 block text-sm font-medium text-slate-700">RUT estudiante</label>
        <input id="validated-rut" name="rut" value={rut} placeholder="12345678-5" maxLength={10} onChange={(event) => setRut(formatRut(event.target.value))} onBlur={() => mark('rut')} aria-invalid={touched.rut && rutInvalid} className={`w-full rounded-xl border px-4 py-3 ${touched.rut && rutInvalid ? 'border-rose-400' : 'border-slate-300'}`} />
        {touched.rut && rutInvalid ? <p className="mt-1 text-sm text-rose-700">Ingresa un RUT chileno válido.</p> : null}
      </div>
      <div>
        <label htmlFor="validated-phone" className="mb-2 block text-sm font-medium text-slate-700">Teléfono estudiante</label>
        <div className="flex gap-2">
          <select name="phone_country_code" value={countryCode} onChange={(event) => setCountryCode(event.target.value)} className="w-28 rounded-xl border border-slate-300 bg-white px-3 py-3">
            <option value="+56">🇨🇱 +56</option>
          </select>
          <input id="validated-phone" name="phone" value={phone} placeholder="9 7999 9999" maxLength={9} inputMode="numeric" onChange={(event) => setPhone(event.target.value.replace(/\D/g, '').slice(0, 9))} onBlur={() => mark('phone')} aria-invalid={touched.phone && phoneInvalid} className={`min-w-0 flex-1 rounded-xl border px-4 py-3 ${touched.phone && phoneInvalid ? 'border-rose-400' : 'border-slate-300'}`} />
        </div>
        {touched.phone && phoneInvalid ? <p className="mt-1 text-sm text-rose-700">Ingresa un celular chileno de 9 dígitos que comience en 9.</p> : null}
      </div>
      <label className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4 text-slate-700">
        <input name="can_leave_alone" type="checkbox" defaultChecked={student.can_leave_alone} className="h-4 w-4" />
        Permitir salida por voluntad del estudiante
      </label>
      <PendingSubmitButton disabled={rutInvalid || phoneInvalid} pendingLabel="Guardando..." className="rounded-xl bg-sky-700 px-4 py-3 font-semibold text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-sky-300">
        Guardar configuración
      </PendingSubmitButton>
    </form>
  );
}
