'use client';

import { useState } from 'react';

import { saveGuardianRelationshipAction } from '@/app/actions/guardian-relationships';
import { PendingSubmitButton } from '@/components/pending-submit-button';
import { SearchableCombobox } from '@/components/searchable-combobox';

type StudentOption = { student_id: number; student_name: string };
type GuardianOption = { id: string; first_name: string | null; last_name: string | null; email: string | null };

export function PrimaryGuardianRelationshipForm({ students, guardians }: { students: StudentOption[]; guardians: GuardianOption[] }) {
  const [studentId, setStudentId] = useState('');
  const [guardianId, setGuardianId] = useState('');

  return <form action={saveGuardianRelationshipAction} className="mt-4 space-y-4">
    <h2 className="font-semibold text-slate-900">Vinculación Apoderado Primario-Estudiante</h2>
    <div className="grid gap-4 md:grid-cols-2">
      <div><label htmlFor="primary-student" className="sr-only">Estudiante</label><SearchableCombobox id="primary-student" name="student_id" value={studentId} onChange={setStudentId} placeholder="Selecciona un estudiante" options={students.map((student) => ({ value: String(student.student_id), label: student.student_name }))} required /></div>
      <div><label htmlFor="primary-guardian-profile" className="sr-only">Apoderado Primario</label><SearchableCombobox id="primary-guardian-profile" name="guardian_profile_id" value={guardianId} onChange={setGuardianId} placeholder="Selecciona un Apoderado Primario" options={guardians.map((guardian) => ({ value: guardian.id, label: `${[guardian.first_name, guardian.last_name].filter(Boolean).join(' ')}${guardian.email ? ` · ${guardian.email}` : ''}` }))} required /></div>
    </div>
    <input type="hidden" name="relation_type" value="APODERADO" />
    <PendingSubmitButton pendingLabel="Guardando..." className="rounded-xl bg-sky-700 px-4 py-3 font-semibold text-white">Guardar vinculación</PendingSubmitButton>
  </form>;
}
