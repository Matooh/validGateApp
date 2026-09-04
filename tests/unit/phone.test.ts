import { describe, expect, it } from 'vitest';

import { isValidChileMobilePhone, normalizeChileMobilePhone } from '../../src/lib/chile/phone';

describe('teléfono móvil chileno', () => {
  it.each([
    ['+56912345678', '+56912345678'],
    ['56912345678', '+56912345678'],
    ['912345678', '+56912345678'],
    ['+56 9 1234 5678', '+56912345678'],
    ['(9) 1234-5678', '+56912345678'],
  ])('normaliza %s a %s', (input, expected) => {
    expect(normalizeChileMobilePhone(input)).toBe(expected);
  });

  it.each(['', ' ', '812345678', '91234567', '+5691234567', '+569123456789', '+56812345678'])
    ('rechaza el teléfono inválido %s', (input) => {
      expect(normalizeChileMobilePhone(input)).toBeNull();
      expect(isValidChileMobilePhone(input)).toBe(false);
    });

  it('identifica un teléfono válido', () => {
    expect(isValidChileMobilePhone('9 1234 5678')).toBe(true);
  });
});
