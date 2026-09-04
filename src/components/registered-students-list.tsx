'use client';

import { useEffect, useMemo, useState } from 'react';

type RegisteredStudent = {
  id: number;
  first_name: string;
  last_name: string;
  link_code: string;
  can_leave_alone: boolean;
  is_in_institution: boolean;
  course_name: string | null;
};

export function RegisteredStudentsList({ students }: { students: RegisteredStudent[] }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set());
  const pageCount = Math.max(1, Math.ceil(students.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visible = useMemo(() => students.slice((currentPage - 1) * pageSize, currentPage * pageSize), [students, currentPage, pageSize]);

  useEffect(() => { setPage(1); setExpanded(new Set()); }, [pageSize, students.length]);
  useEffect(() => { setExpanded(new Set()); }, [currentPage]);

  return <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold text-slate-900">Estudiantes registrados</h2><p className="mt-1 text-sm text-slate-500">Mostrando {students.length ? (currentPage - 1) * pageSize + 1 : 0}-{Math.min(currentPage * pageSize, students.length)} de {students.length} estudiantes.</p></div><label className="flex items-center gap-2 text-sm text-slate-600">Elementos por página<select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} className="rounded-lg border border-slate-300 bg-white px-2 py-2"><option value="10">10</option><option value="25">25</option><option value="50">50</option></select></label></div>
    <div className="mt-4 space-y-3">
      {visible.map((student) => { const isOpen = expanded.has(student.id); const panelId = `registered-student-${student.id}`; return <article key={student.id} className="overflow-hidden rounded-2xl border border-slate-200"><button type="button" aria-expanded={isOpen} aria-controls={panelId} onClick={() => setExpanded((current) => { const next = new Set(current); if (next.has(student.id)) next.delete(student.id); else next.add(student.id); return next; })} className="accordion-trigger flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-slate-50"><span><span className="block font-semibold text-slate-900">{student.first_name} {student.last_name}</span><span className="block text-sm text-slate-500">{student.course_name ?? 'Sin curso'} · Código: {student.link_code}</span></span><span className="flex items-center gap-3 text-sm text-slate-600"><span>{student.is_in_institution ? 'Dentro' : 'Fuera'}</span><span className="accordion-chevron text-xl" aria-hidden="true">⌄</span></span></button>{isOpen ? <div id={panelId} className="border-t border-slate-200 bg-slate-50 p-4 text-sm text-slate-600"><span className="mr-2 rounded-full bg-slate-100 px-3 py-1">{student.can_leave_alone ? 'Puede salir solo' : 'No puede salir solo'}</span><span className="rounded-full bg-slate-100 px-3 py-1">Código {student.link_code}</span></div> : null}</article>; })}
      {!students.length ? <p className="py-4 text-sm text-slate-500">Aún no hay estudiantes registrados.</p> : null}
    </div>
    {pageCount > 1 ? <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><button type="button" disabled={currentPage === 1} onClick={() => setPage((value) => value - 1)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm disabled:opacity-40">Anterior</button><span className="text-sm text-slate-600">Página {currentPage} de {pageCount}</span><button type="button" disabled={currentPage === pageCount} onClick={() => setPage((value) => value + 1)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm disabled:opacity-40">Siguiente</button></div> : null}
  </section>;
}
