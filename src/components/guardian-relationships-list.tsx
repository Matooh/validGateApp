'use client';

import { useMemo, useState, type FormEvent } from 'react';

import { removeGuardianRelationshipAction, saveGuardianRelationshipAction } from '@/app/actions/guardian-relationships';
import { PendingSubmitButton } from '@/components/pending-submit-button';

export type GuardianRelationship = {
  relation_id: number;
  student_id: number;
  student_name: string;
  student_course: string | null;
  guardian_profile_id: string;
  guardian_name: string;
  guardian_email: string;
  relation_type: string;
  linked_at: string;
};

type StudentRelationshipGroup = {
  student: { id: number; name: string; course: string | null };
  relationships: GuardianRelationship[];
};

const RELATION_TYPE_OPTIONS = [
  { value: 'APODERADO_PRINCIPAL', label: 'Apoderado principal' },
  { value: 'APODERADO', label: 'Apoderado' },
  { value: 'RETIRADOR_AUTORIZADO', label: 'Retirador autorizado' },
] as const;

function relationshipLabel(value: string) {
  return RELATION_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

function countLabel(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function RelationshipItem({ relationship }: { relationship: GuardianRelationship }) {
  const [isManaging, setIsManaging] = useState(false);
  const [draftType, setDraftType] = useState(relationship.relation_type);
  const hasChanges = draftType !== relationship.relation_type;
  const titleId = `relationship-${relationship.relation_id}-title`;
  const selectId = `relationship-${relationship.relation_id}-type`;

  function cancelEditing() {
    setDraftType(relationship.relation_type);
    setIsManaging(false);
  }

  function confirmUnlink(event: FormEvent<HTMLFormElement>) {
    if (!window.confirm(`¿Desvincular a ${relationship.guardian_name} de ${relationship.student_name}?`)) {
      event.preventDefault();
    }
  }

  return (
    <article aria-labelledby={titleId} data-testid={`student-relationship-${relationship.relation_id}`} className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h4 id={titleId} className="break-words font-semibold text-slate-900">{relationship.guardian_name}</h4>
          <p className="break-all text-sm text-slate-500">{relationship.guardian_email}</p>
          {!isManaging ? <p className="mt-2 text-sm font-medium text-slate-700">{relationshipLabel(relationship.relation_type)}</p> : null}
        </div>
        {!isManaging ? (
          <button type="button" onClick={() => setIsManaging(true)} className="min-h-11 shrink-0 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600">
            Administrar
          </button>
        ) : null}
      </div>

      {isManaging ? (
        <div className="mt-4 space-y-4 border-t border-slate-200 pt-4">
          <form action={saveGuardianRelationshipAction} className="space-y-4">
            <input type="hidden" name="student_id" value={relationship.student_id} />
            <input type="hidden" name="guardian_profile_id" value={relationship.guardian_profile_id} />
            <div>
              <label htmlFor={selectId} className="mb-2 block text-sm font-medium text-slate-700">Tipo de relación</label>
              <select id={selectId} name="relation_type" value={draftType} onChange={(event) => setDraftType(event.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm sm:max-w-sm">
                {RELATION_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
              <button type="button" onClick={cancelEditing} className="min-h-11 rounded-xl px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600">Cancelar</button>
              <PendingSubmitButton pendingLabel="Guardando..." disabled={!hasChanges} className="min-h-11 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300">Guardar cambios</PendingSubmitButton>
            </div>
          </form>
          <form action={removeGuardianRelationshipAction} onSubmit={confirmUnlink} className="border-t border-slate-200 pt-4">
            <input type="hidden" name="relation_id" value={relationship.relation_id} />
            <PendingSubmitButton pendingLabel="Desvinculando..." className="min-h-11 w-full rounded-xl border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 sm:w-auto">Desvincular</PendingSubmitButton>
          </form>
        </div>
      ) : null}
    </article>
  );
}

export function GuardianRelationshipsList({ relationships }: { relationships: GuardianRelationship[] }) {
  const [query, setQuery] = useState('');
  const [expandedStudents, setExpandedStudents] = useState<Set<number>>(() => new Set());
  const groups = useMemo<StudentRelationshipGroup[]>(() => {
    const grouped = new Map<number, StudentRelationshipGroup>();
    for (const relationship of relationships) {
      const existing = grouped.get(relationship.student_id);
      if (existing) existing.relationships.push(relationship);
      else grouped.set(relationship.student_id, {
        student: { id: relationship.student_id, name: relationship.student_name, course: relationship.student_course },
        relationships: [relationship],
      });
    }
    return Array.from(grouped.values());
  }, [relationships]);
  const filteredGroups = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('es-CL');
    if (!normalized) return groups;
    return groups.filter((group) => group.student.name.toLocaleLowerCase('es-CL').includes(normalized)
      || group.relationships.some((relationship) => relationship.guardian_name.toLocaleLowerCase('es-CL').includes(normalized)));
  }, [query, groups]);
  const filteredRelationshipCount = filteredGroups.reduce((total, group) => total + group.relationships.length, 0);

  function toggleStudent(studentId: number) {
    setExpandedStudents((current) => {
      const next = new Set(current);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  }

  return (
    <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Relaciones actuales</h2>
        <p className="mt-1 text-sm text-slate-500">Busca por estudiante o persona vinculada y despliega un estudiante para administrar sus vínculos.</p>
      </div>
      <div>
        <label htmlFor="relationship-search" className="mb-2 block text-sm font-medium text-slate-700">Buscar relaciones</label>
        <input id="relationship-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nombre de estudiante o apoderado" className="w-full rounded-xl border border-slate-300 px-4 py-3" />
        <p className="mt-2 text-xs text-slate-500" aria-live="polite">{countLabel(filteredGroups.length, 'estudiante', 'estudiantes')} · {countLabel(filteredRelationshipCount, 'vínculo', 'vínculos')}</p>
      </div>

      {filteredGroups.length ? (
        <div className="space-y-3">
          {filteredGroups.map((group) => {
            const isExpanded = expandedStudents.has(group.student.id);
            const panelId = `student-relationship-group-${group.student.id}-panel`;
            return (
              <article key={group.student.id} data-testid={`student-relationship-group-${group.student.id}`} className={`overflow-hidden rounded-2xl border ${isExpanded ? 'border-sky-200' : 'border-slate-200'}`}>
                <h3>
                  <button type="button" aria-expanded={isExpanded} aria-controls={panelId} onClick={() => toggleStudent(group.student.id)} className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-sky-600">
                    <span className="min-w-0">
                      <span className="block break-words font-semibold text-slate-900">{group.student.name}</span>
                      {group.student.course ? <span className="mt-1 block text-sm font-normal text-slate-500">{group.student.course}</span> : null}
                    </span>
                    <span className="flex shrink-0 items-center gap-3">
                      <span className="text-sm font-medium text-slate-600">{countLabel(group.relationships.length, 'vínculo', 'vínculos')}</span>
                      <span className={`text-xl text-slate-500 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} aria-hidden="true">⌄</span>
                    </span>
                  </button>
                </h3>
                {isExpanded ? (
                  <div id={panelId} className="space-y-3 border-t border-slate-200 bg-slate-50/60 p-4">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Personas vinculadas ({group.relationships.length})</h4>
                    {group.relationships.map((relationship) => <RelationshipItem key={relationship.relation_id} relationship={relationship} />)}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <p className="rounded-2xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">{relationships.length ? 'No hay relaciones que coincidan con la búsqueda.' : 'Todavía no existen vinculaciones en esta institución.'}</p>
      )}
    </section>
  );
}
