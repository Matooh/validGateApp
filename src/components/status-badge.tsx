type BadgeDefinition = { label: string; className: string; symbol: string };

const BADGES: Record<string, BadgeDefinition> = {
  INGRESO: { label: 'Ingreso', symbol: '●', className: 'border-emerald-200 bg-emerald-100 text-emerald-800' },
  SALIDA: { label: 'Salida', symbol: '●', className: 'border-blue-200 bg-blue-100 text-blue-800' },
  RETIRO: { label: 'Retiro', symbol: '●', className: 'border-violet-200 bg-violet-100 text-violet-800' },
  RETIRO_AUTORIZADO: { label: 'Retiro', symbol: '●', className: 'border-violet-200 bg-violet-100 text-violet-800' },
  APROBADO: { label: 'Aprobado', symbol: '✓', className: 'border-green-200 bg-green-100 text-green-800' },
  APPROVED: { label: 'Aprobado', symbol: '✓', className: 'border-green-200 bg-green-100 text-green-800' },
  PENDIENTE: { label: 'Pendiente', symbol: '⏳', className: 'border-amber-200 bg-amber-100 text-amber-800' },
  PENDING: { label: 'Pendiente', symbol: '⏳', className: 'border-amber-200 bg-amber-100 text-amber-800' },
  PENDING_STUDENT_RESPONSE: { label: 'Pendiente de respuesta', symbol: '⏳', className: 'border-amber-200 bg-amber-100 text-amber-800' },
  PENDING_GUARD_VALIDATION: { label: 'Pendiente de validación', symbol: '⏳', className: 'border-amber-200 bg-amber-100 text-amber-800' },
  BOTH_VALIDATED: { label: 'Validaciones aprobadas', symbol: '✓', className: 'border-green-200 bg-green-100 text-green-800' },
  RECHAZADO: { label: 'Rechazado', symbol: '×', className: 'border-red-200 bg-red-100 text-red-800' },
  REJECTED: { label: 'Rechazado', symbol: '×', className: 'border-red-200 bg-red-100 text-red-800' },
  FALLIDO: { label: 'Fallido', symbol: '⚠', className: 'border-red-200 bg-red-100 text-red-800' },
  FAILED: { label: 'Fallido', symbol: '⚠', className: 'border-red-200 bg-red-100 text-red-800' },
  EXPIRED: { label: 'Vencido', symbol: '—', className: 'border-gray-200 bg-gray-100 text-gray-700' },
  VENCIDO: { label: 'Vencido', symbol: '—', className: 'border-gray-200 bg-gray-100 text-gray-700' },
  CANCELLED: { label: 'Cancelado', symbol: '—', className: 'border-slate-200 bg-slate-100 text-slate-700' },
  CANCELED: { label: 'Cancelado', symbol: '—', className: 'border-slate-200 bg-slate-100 text-slate-700' },
  ANULADO: { label: 'Anulado', symbol: '—', className: 'border-slate-200 bg-slate-100 text-slate-700' },
  MANUAL: { label: 'Manual', symbol: '◆', className: 'border-orange-200 bg-orange-100 text-orange-800' },
  CONTINGENCIA: { label: 'Contingencia', symbol: '◆', className: 'border-orange-200 bg-orange-100 text-orange-800' },
};

function fallbackDefinition(value: string): BadgeDefinition {
  return {
    label: value.replaceAll('_', ' ').toLocaleLowerCase('es-CL').replace(/^./, (letter) => letter.toUpperCase()),
    symbol: '•',
    className: 'border-slate-200 bg-slate-100 text-slate-700',
  };
}

export function StatusBadge({ value }: { value: string | null | undefined }) {
  const normalized = value?.trim().toUpperCase() || 'SIN_ESTADO';
  const definition = BADGES[normalized] ?? fallbackDefinition(normalized);

  return (
    <span className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${definition.className}`}>
      <span aria-hidden="true">{definition.symbol}</span>
      <span className="truncate">{definition.label}</span>
    </span>
  );
}
