export type Traceability = {
  requirement: string;
  objectives: string;
  role: string;
};

export const TRACEABILITY: Record<string, Traceability> = {
  'PF-AUTH-002': { requirement: 'RF01', objectives: 'OE2, OE4', role: 'Todos los roles' },
  'PF-AUTH-003': { requirement: 'RF01', objectives: 'OE2, OE4', role: 'Usuario' },
  'PF-ACC-002': { requirement: 'RF05', objectives: 'OE2, OE4', role: 'Todos los roles' },
  'PF-ACC-003': { requirement: 'RF05', objectives: 'OE2, OE4', role: 'Apoderado' },
  'PF-VIN-001': { requirement: 'RF03', objectives: 'OE2, OE4', role: 'Apoderado' },
  'PF-VIN-002': { requirement: 'RF03', objectives: 'OE2, OE4', role: 'Apoderado' },
  'PF-VIN-ADM-001': { requirement: 'RF03', objectives: 'OE2, OE4', role: 'Administrador' },
  'PF-VIN-ADM-002': { requirement: 'RF05', objectives: 'OE2, OE4', role: 'Roles no administradores' },
  'PF-VIN-ADM-003': { requirement: 'RF03', objectives: 'OE2, OE4', role: 'Administrador' },
  'PF-VIN-ADM-004': { requirement: 'RF03', objectives: 'OE2, OE4', role: 'Administrador' },
  'PF-ING-001': { requirement: 'RF07', objectives: 'OE3, OE4', role: 'Portería' },
  'PF-ING-003': { requirement: 'RF07', objectives: 'OE3, OE4', role: 'Portería' },
  'PF-SAL-003': { requirement: 'RF08', objectives: 'OE3, OE4', role: 'Portería' },
  'PF-SAL-004': { requirement: 'RF08', objectives: 'OE3, OE4', role: 'Estudiante y Portería' },
  'PF-RET-001': { requirement: 'RF09', objectives: 'OE3, OE4', role: 'Apoderado' },
  'PF-RET-003': { requirement: 'RF09', objectives: 'OE3, OE4', role: 'Estudiante' },
  'PF-RET-004': { requirement: 'RF09', objectives: 'OE3, OE4', role: 'Portería' },
  'PF-RET-005': { requirement: 'RF09', objectives: 'OE3, OE4', role: 'Apoderado y Estudiante' },
  'PF-RET-006': { requirement: 'RF09', objectives: 'OE3, OE4', role: 'Portería' },
  'PF-RET-AUT-001': { requirement: 'RF04', objectives: 'OE2, OE3, OE4', role: 'Apoderado' },
  'PF-RET-AUT-002': { requirement: 'RF04', objectives: 'OE2, OE3, OE4', role: 'Apoderado' },
  'PF-RET-AUT-003': { requirement: 'RF09', objectives: 'OE2, OE3, OE4', role: 'Retirador, Estudiante y Portería' },
  'PF-RET-AUT-004': { requirement: 'RF09', objectives: 'OE2, OE3, OE4', role: 'Retirador autorizado' },
  'PF-RET-AUT-005': { requirement: 'RF04', objectives: 'OE2, OE3, OE4', role: 'Apoderado' },
  'PF-RET-AUT-006': { requirement: 'RF09', objectives: 'OE2, OE3, OE4', role: 'Portería' },
  'PF-RET-AUT-007': { requirement: 'RF09', objectives: 'OE2, OE3, OE4', role: 'Retirador autorizado' },
  'PF-SAU-001': { requirement: 'RF11', objectives: 'OE3, OE4', role: 'Estudiante' },
  'PF-SOL-002': { requirement: 'RF12', objectives: 'OE3, OE4', role: 'Apoderado' },
};

export function scenarioId(title: string): string {
  return title.match(/PF-(?:[A-Z]+-)+\d{3}/)?.[0] ?? 'SIN-ID';
}
