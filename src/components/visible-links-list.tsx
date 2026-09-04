'use client';

import { useMemo, useState } from 'react';

import { revokeAuthorizedRetiradorAction } from '@/app/actions/authorized-retrievers';
import { removeGuardianRelationshipAction } from '@/app/actions/guardian-relationships';
import { PendingSubmitButton } from '@/components/pending-submit-button';

export type VisibleLinkItem = {
  relation_id: number;
  student_id: number;
  student_name: string;
  institution_name: string;
  person_name: string;
  relation_type: 'APODERADO' | 'RETIRADOR_AUTORIZADO';
  valid_from: string | null;
  valid_until: string | null;
  revoked_at: string | null;
  is_active: boolean;
  can_revoke: boolean;
};

function relationshipLabel(type: VisibleLinkItem['relation_type']) {
  return type === 'APODERADO' ? 'Apoderado Primario' : 'Apoderado Secundario';
}

export function VisibleLinksList({ links, role }: { links: VisibleLinkItem[]; role?: string }) {
  const [expandedStudents, setExpandedStudents] = useState<Set<number>>(() => new Set());
  const grouped = useMemo(() => {
    const result = new Map<number, VisibleLinkItem[]>();
    for (const link of links) result.set(link.student_id, [...(result.get(link.student_id) ?? []), link]);
    return Array.from(result.values());
  }, [links]);

  function toggle(studentId: number) {
    setExpandedStudents((current) => {
      const next = new Set(current);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  }

  if (!links.length) {
    return <p className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">No tienes vínculos disponibles.</p>;
  }

  return (
    <div className="space-y-3">
      {grouped.map((studentLinks) => {
        const student = studentLinks[0];
        const expanded = expandedStudents.has(student.student_id);
        const panelId = `visible-student-${student.student_id}-panel`;
        return (
          <article key={student.student_id} className={`overflow-hidden rounded-3xl border bg-white shadow-sm ${expanded ? 'border-sky-200' : 'border-slate-200'}`}>
            <h2>
              <button type="button" aria-expanded={expanded} aria-controls={panelId} onClick={() => toggle(student.student_id)} className="accordion-trigger flex w-full items-center justify-between gap-4 p-5 text-left transition hover:bg-slate-50 sm:p-6">
                <span className="min-w-0">
                  <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">Estudiante</span>
                  <span className="mt-1 block break-words text-xl font-semibold text-slate-900">{student.student_name}</span>
                  <span className="block text-sm text-slate-500">{student.institution_name}</span>
                </span>
                <span className="flex shrink-0 items-center gap-3 text-sm font-medium text-slate-600">
                  {studentLinks.length} {studentLinks.length === 1 ? 'vínculo' : 'vínculos'}
                  <span className="accordion-chevron text-xl text-slate-400" aria-hidden="true">⌄</span>
                </span>
              </button>
            </h2>
            {expanded ? (
              <div id={panelId} className="space-y-3 border-t border-slate-200 bg-slate-50/60 p-4 sm:p-5">
                {studentLinks.map((link) => (
                  <div key={link.relation_id} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">{link.person_name}</p>
                        <p className="mt-1 text-sm text-slate-600">{relationshipLabel(link.relation_type)}</p>
                        {link.relation_type === 'RETIRADOR_AUTORIZADO' && link.valid_from && link.valid_until ? (
                          <p className="mt-1 text-xs text-slate-500">Desde {new Date(link.valid_from).toLocaleString('es-CL')} hasta {new Date(link.valid_until).toLocaleString('es-CL')}</p>
                        ) : null}
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${link.is_active ? 'bg-emerald-100 text-emerald-800' : link.revoked_at ? 'bg-slate-100 text-slate-700' : 'bg-gray-100 text-gray-700'}`}>
                        {link.is_active ? 'Vigente' : link.revoked_at ? 'Revocado' : 'Vencido'}
                      </span>
                    </div>
                    {link.is_active && (link.can_revoke || (role === 'APODERADO' && link.relation_type === 'RETIRADOR_AUTORIZADO')) ? (
                      <form action={revokeAuthorizedRetiradorAction} className="mt-3">
                        <input type="hidden" name="relation_id" value={link.relation_id} />
                        <PendingSubmitButton pendingLabel="Revocando..." className="rounded-xl border border-rose-300 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50">Revocar autorización</PendingSubmitButton>
                      </form>
                    ) : null}
                    {role === 'ADMIN' && link.is_active && link.relation_type === 'APODERADO' ? (
                      <form action={removeGuardianRelationshipAction} className="mt-3 border-t border-slate-100 pt-3">
                        <input type="hidden" name="relation_id" value={link.relation_id} />
                        <PendingSubmitButton pendingLabel="Eliminando..." className="rounded-xl border border-rose-300 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50">Eliminar vínculo</PendingSubmitButton>
                      </form>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
