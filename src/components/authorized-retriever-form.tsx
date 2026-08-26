'use client';

import { useEffect, useRef, useState } from 'react';

import { inviteAuthorizedRetiradorAction } from '@/app/actions/authorized-retrievers';
import { PendingSubmitButton } from '@/components/pending-submit-button';

type StudentOption = { student_id: number; student_name: string; institution_name: string };

function toLocalInputValue(date: Date) {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 16);
}

export function AuthorizedRetrieverForm({ students }: { students: StudentOption[] }) {
  const [timezoneOffset, setTimezoneOffset] = useState(0);
  const [validFrom, setValidFrom] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const validFromIsoRef = useRef<HTMLInputElement>(null);
  const validUntilIsoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const initialStart = new Date();
    const initialEnd = new Date(initialStart.getTime() + 24 * 60 * 60 * 1000);
    setTimezoneOffset(initialStart.getTimezoneOffset());
    setValidFrom(toLocalInputValue(initialStart));
    setValidUntil(toLocalInputValue(initialEnd));
  }, []);

  return (
    <form action={inviteAuthorizedRetiradorAction} onSubmit={() => {
      if (validFromIsoRef.current) validFromIsoRef.current.value = validFrom ? new Date(validFrom).toISOString() : '';
      if (validUntilIsoRef.current) validUntilIsoRef.current.value = validUntil ? new Date(validUntil).toISOString() : '';
    }} className="space-y-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Autorizar retirador</h2>
        <p className="mt-1 text-sm text-slate-500">Se enviará una invitación por correo. El acceso solo estará disponible durante el período indicado.</p>
      </div>
      <input type="hidden" name="timezone_offset_minutes" value={timezoneOffset} />
      <input ref={validFromIsoRef} type="hidden" name="valid_from_iso" />
      <input ref={validUntilIsoRef} type="hidden" name="valid_until_iso" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label htmlFor="authorized-student" className="mb-2 block text-sm font-medium text-slate-700">Estudiante</label>
          <select id="authorized-student" name="student_id" required className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3">
            <option value="">Selecciona un estudiante</option>
            {students.map((student) => <option key={student.student_id} value={student.student_id}>{student.student_name} · {student.institution_name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="retriever-first-name" className="mb-2 block text-sm font-medium text-slate-700">Nombres</label>
          <input id="retriever-first-name" name="first_name" required autoComplete="given-name" className="w-full rounded-xl border border-slate-300 px-4 py-3" />
        </div>
        <div>
          <label htmlFor="retriever-last-name" className="mb-2 block text-sm font-medium text-slate-700">Apellidos</label>
          <input id="retriever-last-name" name="last_name" required autoComplete="family-name" className="w-full rounded-xl border border-slate-300 px-4 py-3" />
        </div>
        <div className="md:col-span-2">
          <label htmlFor="retriever-email" className="mb-2 block text-sm font-medium text-slate-700">Correo</label>
          <input id="retriever-email" name="email" type="email" required autoComplete="email" className="w-full rounded-xl border border-slate-300 px-4 py-3" />
        </div>
        <div className="md:col-span-2">
          <label htmlFor="retriever-rut" className="mb-2 block text-sm font-medium text-slate-700">RUT</label>
          <input
            id="retriever-rut"
            name="rut"
            required
            autoComplete="off"
            placeholder="12345678-5"
            className="w-full rounded-xl border border-slate-300 px-4 py-3"
          />
          <p className="mt-2 text-xs text-slate-500">Se utilizará para identificar y reutilizar de forma segura a un retirador registrado previamente.</p>
        </div>
        <div>
          <label htmlFor="valid-from" className="mb-2 block text-sm font-medium text-slate-700">Válido desde</label>
          <input id="valid-from" name="valid_from" type="datetime-local" required value={validFrom} onChange={(event) => setValidFrom(event.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-3" />
        </div>
        <div>
          <label htmlFor="valid-until" className="mb-2 block text-sm font-medium text-slate-700">Válido hasta</label>
          <input id="valid-until" name="valid_until" type="datetime-local" required min={validFrom} value={validUntil} onChange={(event) => setValidUntil(event.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-3" />
        </div>
      </div>
      <PendingSubmitButton pendingLabel="Enviando invitación..." disabled={!students.length} className="rounded-xl bg-sky-700 px-4 py-3 font-semibold text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-sky-300">
        Invitar y autorizar
      </PendingSubmitButton>
    </form>
  );
}
