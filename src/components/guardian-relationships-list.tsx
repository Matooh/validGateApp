'use client';

import { useMemo, useState } from 'react';

import { removeGuardianRelationshipAction, saveGuardianRelationshipAction } from '@/app/actions/guardian-relationships';
import { PendingSubmitButton } from '@/components/pending-submit-button';

export type GuardianRelationship = {
  relation_id: number;
  student_id: number;
  student_name: string;
  guardian_profile_id: string;
  guardian_name: string;
  guardian_email: string;
  relation_type: string;
  linked_at: string;
};

export function GuardianRelationshipsList({ relationships }: { relationships: GuardianRelationship[] }) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('es-CL');
    if (!normalized) return relationships;
    return relationships.filter((relationship) =>
      relationship.student_name.toLocaleLowerCase('es-CL').includes(normalized)
      || relationship.guardian_name.toLocaleLowerCase('es-CL').includes(normalized),
    );
  }, [query, relationships]);

  return (
    <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Relaciones actuales</h2>
        <p className="mt-1 text-sm text-slate-500">Busca por estudiante o apoderado y despliega una relación para administrarla.</p>
      </div>
      <div>
        <label htmlFor="relationship-search" className="mb-2 block text-sm font-medium text-slate-700">Buscar relaciones</label>
        <input id="relationship-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nombre de estudiante o apoderado" className="w-full rounded-xl border border-slate-300 px-4 py-3" />
        <p className="mt-2 text-xs text-slate-500" aria-live="polite">{filtered.length} relación{filtered.length === 1 ? '' : 'es'} encontrada{filtered.length === 1 ? '' : 's'}.</p>
      </div>

      {filtered.length ? (
        <div className="space-y-3">
          {filtered.map((relationship) => (
            <details key={relationship.relation_id} className="group overflow-hidden rounded-2xl border border-slate-200 open:border-sky-200">
              <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-4 py-4 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-sky-600 [&::-webkit-details-marker]:hidden">
                <div className="min-w-0">
                  <p className="break-words font-semibold text-slate-900">{relationship.student_name} <span aria-hidden="true">↔</span> {relationship.guardian_name}</p>
                  <p className="mt-1 text-sm text-slate-500">Apoderado</p>
                </div>
                <span className="text-xl text-slate-500 transition-transform duration-200 group-open:rotate-180" aria-hidden="true">⌄</span>
              </summary>
              <div className="grid gap-4 border-t border-slate-200 bg-slate-50/60 p-4 md:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Estudiante</p>
                  <p className="mt-1 font-semibold text-slate-900">{relationship.student_name}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Apoderado</p>
                  <p className="mt-1 font-semibold text-slate-900">{relationship.guardian_name}</p>
                  <p className="break-all text-sm text-slate-500">{relationship.guardian_email}</p>
                </div>
                <form action={saveGuardianRelationshipAction} className="space-y-2 md:col-span-2">
                  <input type="hidden" name="student_id" value={relationship.student_id} />
                  <input type="hidden" name="guardian_profile_id" value={relationship.guardian_profile_id} />
                  <label htmlFor={`relation-${relationship.relation_id}`} className="block text-sm font-medium text-slate-700">Tipo de relación actual</label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <select id={`relation-${relationship.relation_id}`} name="relation_type" defaultValue="APODERADO" className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm">
                      <option value="APODERADO">Apoderado</option>
                    </select>
                    <PendingSubmitButton pendingLabel="Cambiando..." className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">Cambiar</PendingSubmitButton>
                  </div>
                </form>
                <form action={removeGuardianRelationshipAction} className="md:col-span-2">
                  <input type="hidden" name="relation_id" value={relationship.relation_id} />
                  <PendingSubmitButton pendingLabel="Desvinculando..." className="rounded-xl border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50">Desvincular</PendingSubmitButton>
                </form>
              </div>
            </details>
          ))}
        </div>
      ) : (
        <p className="rounded-2xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">{relationships.length ? 'No hay relaciones que coincidan con la búsqueda.' : 'Todavía no existen vinculaciones en esta institución.'}</p>
      )}
    </section>
  );
}
