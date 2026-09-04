import { describe, expect, it } from 'vitest';

import { formatRut, isValidRut, normalizeRut } from '../../src/lib/chile/rut';

describe('RUT chileno', () => {
  it('formatea un RUT válido sin puntos', () => {
    expect(formatRut('12.345.678-5')).toBe('12345678-5');
  });

  it('limpia separadores y normaliza la K en mayúscula', () => {
    expect(formatRut('  11.111.111-k ')).toBe('11111111-K');
  });

  it('conserva valores parciales sin intentar formatearlos', () => {
    expect(formatRut('12.345')).toBe('12345');
  });

  it('acepta un RUT válido con y sin formato', () => {
    expect(isValidRut('12.345.678-5')).toBe(true);
    expect(normalizeRut('12345678-5')).toBe('12345678-5');
  });

  it('rechaza RUT vacío, incompleto y con dígito verificador incorrecto', () => {
    expect(normalizeRut('')).toBeNull();
    expect(normalizeRut('12.345')).toBeNull();
    expect(isValidRut('12.345.678-6')).toBe(false);
  });
});
