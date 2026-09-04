'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { inviteAuthorizedRetiradorAction } from '@/app/actions/authorized-retrievers';
import { PendingSubmitButton } from '@/components/pending-submit-button';
import { SearchableCombobox } from '@/components/searchable-combobox';

type StudentOption = { student_id: number; student_name: string; institution_name: string };
type GuardianOption = { id: string; first_name: string | null; last_name: string | null; email: string | null };

function localValue(date: Date) { return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }

export function AuthorizedRetrieverForm({ students, guardians }: { students: StudentOption[]; guardians: GuardianOption[] }) {
  const [timezoneOffset, setTimezoneOffset] = useState(0);
  const [validFrom, setValidFrom] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [studentId, setStudentId] = useState('');
  const [guardianId, setGuardianId] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const validFromIsoRef = useRef<HTMLInputElement>(null);
  const validUntilIsoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const now = new Date();
    setTimezoneOffset(now.getTimezoneOffset());
    setValidFrom(localValue(now));
    setValidUntil(localValue(new Date(now.getTime() + 86400000)));
  }, []);

  const errors = useMemo(() => ({
    student: studentId ? '' : 'Selecciona un estudiante.',
    guardian: guardianId ? '' : 'Selecciona un apoderado.',
    validFrom: validFrom ? '' : 'Indica desde cuándo es válida la autorización.',
    validUntil: !validUntil ? 'Indica hasta cuándo es válida la autorización.' : validFrom && validUntil <= validFrom ? 'La fecha final debe ser posterior a la inicial.' : '',
    confirmation: confirmed ? '' : 'Debes confirmar la autorización.',
  }), [studentId, guardianId, validFrom, validUntil, confirmed]);
  const hasErrors = !students.length || !guardians.length || Object.values(errors).some(Boolean);
  const showError = (field: keyof typeof errors) => touched[field] && errors[field];
  const markTouched = (field: keyof typeof errors) => setTouched((current) => ({ ...current, [field]: true }));

  return <form action={inviteAuthorizedRetiradorAction} noValidate onSubmit={(event) => {
    if (hasErrors) { event.preventDefault(); setTouched(Object.fromEntries(Object.keys(errors).map((key) => [key, true]))); return; }
    if (validFromIsoRef.current) validFromIsoRef.current.value = new Date(validFrom).toISOString();
    if (validUntilIsoRef.current) validUntilIsoRef.current.value = new Date(validUntil).toISOString();
  }} className="space-y-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
    <div><h2 className="text-xl font-semibold text-slate-900">Vinculación Apoderado Secundario-Estudiante</h2><p className="mt-1 text-sm text-slate-500">Selecciona un apoderado ya registrado en tu institución y define el período de autorización.</p></div>
    <input type="hidden" name="timezone_offset_minutes" value={timezoneOffset} /><input ref={validFromIsoRef} type="hidden" name="valid_from_iso" /><input ref={validUntilIsoRef} type="hidden" name="valid_until_iso" />
    <div className="grid gap-4 md:grid-cols-2">
      <div className="md:col-span-2"><label htmlFor="authorized-student" className="mb-2 block text-sm font-medium text-slate-700">Estudiante</label><SearchableCombobox id="authorized-student" name="student_id" value={studentId} onChange={(value) => { setStudentId(value); markTouched('student'); }} placeholder="Selecciona un estudiante" options={students.map((student) => ({ value: String(student.student_id), label: `${student.student_name} · ${student.institution_name}` }))} required />{showError('student') ? <p className="mt-1 text-sm text-rose-700">{errors.student}</p> : null}</div>
      <div className="md:col-span-2"><label htmlFor="guardian-profile" className="mb-2 block text-sm font-medium text-slate-700">Apoderado secundario</label><SearchableCombobox id="guardian-profile" name="guardian_profile_id" value={guardianId} onChange={(value) => { setGuardianId(value); markTouched('guardian'); }} placeholder="Selecciona un apoderado" options={guardians.map((guardian) => ({ value: guardian.id, label: `${[guardian.first_name, guardian.last_name].filter(Boolean).join(' ')}${guardian.email ? ` · ${guardian.email}` : ''}` }))} required />{showError('guardian') ? <p className="mt-1 text-sm text-rose-700">{errors.guardian}</p> : null}</div>
      <div><label htmlFor="valid-from" className="mb-2 block text-sm font-medium text-slate-700">Válido desde</label><input id="valid-from" name="valid_from" type="datetime-local" value={validFrom} onChange={(event) => setValidFrom(event.target.value)} onBlur={() => markTouched('validFrom')} className="w-full rounded-xl border px-4 py-3" /></div>
      <div><label htmlFor="valid-until" className="mb-2 block text-sm font-medium text-slate-700">Válido hasta</label><input id="valid-until" name="valid_until" type="datetime-local" min={validFrom} value={validUntil} onChange={(event) => setValidUntil(event.target.value)} onBlur={() => markTouched('validUntil')} className="w-full rounded-xl border px-4 py-3" /></div>
    </div>
    <label className="flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950"><input type="checkbox" name="confirm_existing_retriever_authorization" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} onBlur={() => markTouched('confirmation')} className="mt-0.5 h-4 w-4" /><span>Confirmo que puede retirar al estudiante durante el período indicado.</span></label>
    {showError('confirmation') ? <p className="text-sm text-rose-700">{errors.confirmation}</p> : null}
    <PendingSubmitButton pendingLabel="Guardando autorización..." disabled={hasErrors} className="rounded-xl bg-sky-700 px-4 py-3 font-semibold text-white disabled:bg-sky-300">Autorizar apoderado</PendingSubmitButton>
  </form>;
}
