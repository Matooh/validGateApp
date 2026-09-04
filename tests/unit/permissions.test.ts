import { describe, expect, it } from 'vitest';

import { hasAnyPermission, hasPermission } from '../../src/lib/permissions';
import type { AppPermission } from '../../src/lib/permissions';
import type { AppRole } from '../../src/lib/types';

describe('permisos por rol', () => {
  const cases: Array<[AppRole, AppPermission, boolean]> = [
    ['ADMIN', 'manage_users', true],
    ['ADMIN', 'view_guard_module', true],
    ['PORTERIA', 'register_access_event', true],
    ['PORTERIA', 'manage_users', false],
    ['DOCENTE', 'view_attendance', true],
    ['DOCENTE', 'authorize_retirador', false],
    ['APODERADO', 'authorize_retirador', true],
    ['APODERADO', 'register_access_event', false],
    ['RETIRADOR_AUTORIZADO', 'view_students_linked', true],
    ['RETIRADOR_AUTORIZADO', 'authorize_retirador', false],
    ['ESTUDIANTE', 'view_authentications', true],
    ['ESTUDIANTE', 'view_guard_module', false],
  ];

  it.each(cases)('%s tiene %s: %s', (role, permission, expected) => {
    expect(hasPermission(role, permission)).toBe(expected);
  });

  it('deniega permisos sin rol', () => {
    expect(hasPermission(null, 'view_dashboard')).toBe(false);
    expect(hasPermission(undefined, 'view_dashboard')).toBe(false);
  });

  it('devuelve verdadero si al menos uno de los permisos está disponible', () => {
    expect(hasAnyPermission('PORTERIA', ['manage_users', 'view_guard_module'])).toBe(true);
    expect(hasAnyPermission('PORTERIA', ['manage_users', 'manage_roles'])).toBe(false);
    expect(hasAnyPermission(null, ['view_dashboard'])).toBe(false);
  });
});
