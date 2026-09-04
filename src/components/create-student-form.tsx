'use client';

import { useState } from 'react';

import { createStudentAction } from '@/app/actions/students';
import { PendingSubmitButton } from '@/components/pending-submit-button';
import { SearchableCombobox } from '@/components/searchable-combobox';

type CourseOption = { id: number; name: string };

export function CreateStudentForm({ courses }: { courses: CourseOption[] }) {
  const [canLeaveAlone, setCanLeaveAlone] = useState(false);
  const [createAccess, setCreateAccess] = useState(false);
  const [courseId, setCourseId] = useState('');

  return (
    <form action={createStudentAction} className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Nuevo estudiante</h2>
        <p className="mt-1 text-sm text-slate-500">El código de vinculación se genera automáticamente.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="student-first-name" className="mb-2 block text-sm font-medium text-slate-700">Nombres</label>
          <input id="student-first-name" name="first_name" required className="w-full rounded-xl border border-slate-300 px-4 py-3" />
        </div>
        <div>
          <label htmlFor="student-last-name" className="mb-2 block text-sm font-medium text-slate-700">Apellidos</label>
          <input id="student-last-name" name="last_name" required className="w-full rounded-xl border border-slate-300 px-4 py-3" />
        </div>
      </div>
      <div>
        <label htmlFor="student-course" className="mb-2 block text-sm font-medium text-slate-700">Curso</label>
        <SearchableCombobox id="student-course" name="course_id" value={courseId} onChange={setCourseId} placeholder="Selecciona un curso" options={courses.map((course) => ({ value: String(course.id), label: course.name }))} required />
      </div>
      <label className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4 text-sm text-slate-700">
        <input name="can_leave_alone" type="checkbox" checked={canLeaveAlone} onChange={(event) => setCanLeaveAlone(event.target.checked)} className="h-4 w-4" />
        Permitir salida por voluntad del estudiante
      </label>
      <label className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4 text-sm text-slate-700">
        <input name="create_access" type="checkbox" checked={createAccess} onChange={(event) => setCreateAccess(event.target.checked)} className="h-4 w-4" />
        Crear acceso para que el estudiante pueda iniciar sesión
      </label>
      {createAccess ? (
        <div className="grid gap-4 rounded-2xl border border-sky-100 bg-sky-50 p-4 md:grid-cols-2">
          <div>
            <label htmlFor="student-access-email" className="mb-2 block text-sm font-medium text-slate-700">Correo de acceso</label>
            <input id="student-access-email" name="access_email" type="email" required={createAccess} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3" />
          </div>
          <div>
            <label htmlFor="student-access-password" className="mb-2 block text-sm font-medium text-slate-700">Contraseña temporal</label>
            <input id="student-access-password" name="access_password" type="password" minLength={6} required={createAccess} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3" />
          </div>
          <p className="text-xs text-slate-600 md:col-span-2">Entrégale estas credenciales al estudiante. El correo quedará confirmado automáticamente para este MVP.</p>
        </div>
      ) : null}
      <PendingSubmitButton disabled={!courses.length} pendingLabel="Creando..." className="rounded-xl bg-sky-700 px-4 py-3 font-semibold text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-sky-300">
        Crear estudiante
      </PendingSubmitButton>
    </form>
  );
}
