export type Traceability = {
  requirement: string;
  objectives: string;
  role: string;
};

export const TRACEABILITY: Record<string, Traceability> = {
  'PF-AUTH-002A': { requirement: 'RF01', objectives: 'OE2, OE4', role: 'Administrador' },
  'PF-AUTH-002B': { requirement: 'RF01', objectives: 'OE2, OE4', role: 'Portería' },
  'PF-AUTH-002C': { requirement: 'RF01', objectives: 'OE2, OE4', role: 'Docente' },
  'PF-AUTH-002D': { requirement: 'RF01', objectives: 'OE2, OE4', role: 'Apoderado Primario' },
  'PF-AUTH-002E': { requirement: 'RF01', objectives: 'OE2, OE4', role: 'Estudiante' },
  'PF-AUTH-003': { requirement: 'RF01', objectives: 'OE2, OE4', role: 'Usuario' },
  'PF-AUTH-004': { requirement: 'RF01', objectives: 'OE2, OE4', role: 'admin' },
  'PF-AUTH-005': { requirement: 'RF01', objectives: 'OE2, OE4', role: 'admin' },
  'PF-ACC-002A': { requirement: 'RF05', objectives: 'OE2, OE4', role: 'Apoderado Primario' },
  'PF-ACC-002B': { requirement: 'RF05', objectives: 'OE2, OE4', role: 'Estudiante' },
  'PF-ACC-002C': { requirement: 'RF05', objectives: 'OE2, OE4', role: 'Docente' },
  'PF-ACC-003': { requirement: 'RF05', objectives: 'OE2, OE4', role: 'Apoderado Primario' },
  'PF-VIN-001A': { requirement: 'RF03', objectives: 'OE2, OE4', role: 'Apoderado Primario' },
  'PF-VIN-001B': { requirement: 'RF03', objectives: 'OE2, OE4', role: 'Apoderado Primario' },
  'PF-VIN-001C': { requirement: 'RF03', objectives: 'OE2, OE4', role: 'Estudiante' },
  'PF-VIN-002A': { requirement: 'RF03', objectives: 'OE2, OE4', role: 'Apoderado Primario' },
  'PF-VIN-002B': { requirement: 'RF03', objectives: 'OE2, OE4', role: 'Apoderado Primario' },
  'PF-VIN-ADM-001': { requirement: 'RF03', objectives: 'OE2, OE4', role: 'Administrador' },
  'PF-VIN-ADM-002A': { requirement: 'RF05', objectives: 'OE2, OE4', role: 'Portería' },
  'PF-VIN-ADM-002B': { requirement: 'RF05', objectives: 'OE2, OE4', role: 'Docente' },
  'PF-VIN-ADM-002C': { requirement: 'RF05', objectives: 'OE2, OE4', role: 'Apoderado Primario' },
  'PF-VIN-ADM-002D': { requirement: 'RF05', objectives: 'OE2, OE4', role: 'Estudiante' },
  'PF-VIN-ADM-003': { requirement: 'RF03', objectives: 'OE2, OE4', role: 'Administrador' },
  'PF-VIN-ADM-004': { requirement: 'RF03', objectives: 'OE2, OE4', role: 'Administrador' },
  'PF-EST-DET-002': { requirement: 'RF02', objectives: 'OE2, OE4', role: 'Administrador' },
  'PF-ING-001A': { requirement: 'RF07', objectives: 'OE3, OE4', role: 'Portería' },
  'PF-ING-001B': { requirement: 'RF07', objectives: 'OE3, OE4', role: 'Portería' },
  'PF-ING-003': { requirement: 'RF07', objectives: 'OE3, OE4', role: 'Portería' },
  'PF-SAL-003A': { requirement: 'RF08', objectives: 'OE3, OE4', role: 'Portería' },
  'PF-SAL-003B': { requirement: 'RF08', objectives: 'OE3, OE4', role: 'Portería' },
  'PF-SAL-003C': { requirement: 'RF08', objectives: 'OE3, OE4', role: 'Portería' },
  'PF-SAL-004': { requirement: 'RF08', objectives: 'OE3, OE4', role: 'Estudiante y Portería' },
  'PF-RET-001': { requirement: 'RF09', objectives: 'OE3, OE4', role: 'Apoderado Primario' },
  'PF-RET-003': { requirement: 'RF09', objectives: 'OE3, OE4', role: 'Estudiante' },
  'PF-RET-004': { requirement: 'RF09', objectives: 'OE3, OE4', role: 'Portería' },
  'PF-RET-005': { requirement: 'RF09', objectives: 'OE3, OE4', role: 'Apoderado Primario y Estudiante' },
  'PF-RET-006': { requirement: 'RF09', objectives: 'OE3, OE4', role: 'Portería' },
  'PF-APO-SEC-001': { requirement: 'RF04', objectives: 'OE2, OE3, OE4', role: 'Apoderado Primario' },
  'PF-APO-SEC-002': { requirement: 'RF04', objectives: 'OE2, OE3, OE4', role: 'Apoderado Primario' },
  'PF-APO-SEC-003': { requirement: 'RF09', objectives: 'OE2, OE3, OE4', role: 'Apoderado Secundario, Estudiante y Portería' },
  'PF-APO-SEC-004': { requirement: 'RF09', objectives: 'OE2, OE3, OE4', role: 'Apoderado Secundario' },
  'PF-APO-SEC-005': { requirement: 'RF04', objectives: 'OE2, OE3, OE4', role: 'Apoderado Primario' },
  'PF-APO-SEC-007': { requirement: 'RF09', objectives: 'OE2, OE3, OE4', role: 'Apoderado Secundario' },
  'PF-SOL-002A': { requirement: 'RF12', objectives: 'OE3, OE4', role: 'Apoderado Primario' },
  'PF-SOL-002B': { requirement: 'RF12', objectives: 'OE3, OE4', role: 'Apoderado Primario' },
  'PF-TRA-002A': { requirement: 'RF14', objectives: 'OE2, OE3, OE4', role: 'Apoderados y Estudiantes' },
  'PF-TRA-002B': { requirement: 'RF14', objectives: 'OE2, OE3, OE4', role: 'Administrador y Portería' },
  'PF-TRA-002C': { requirement: 'RF14', objectives: 'OE2, OE3, OE4', role: 'Apoderado Secundario' },
  'PF-TRA-002D': { requirement: 'RF14', objectives: 'OE2, OE3, OE4', role: 'Docente' },
  'PF-TRA-002E': { requirement: 'RF14', objectives: 'OE2, OE3, OE4', role: 'Docentes' },
};

export function scenarioId(title: string): string {
  return title.match(/PF-(?:[A-Z]+-)+\d{3}[A-Z]?/)?.[0] ?? 'SIN-ID';
}
