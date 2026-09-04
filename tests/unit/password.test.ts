import { describe, expect, it } from 'vitest';

import { MIN_PASSWORD_LENGTH, validatePassword } from '../../src/lib/password';

describe('validación de contraseña', () => {
  it('exige una contraseña', () => {
    expect(validatePassword('')).not.toBeNull();
  });

  it('rechaza contraseñas menores al mínimo', () => {
    expect(validatePassword('12345')).toContain(String(MIN_PASSWORD_LENGTH));
  });

  it('acepta una contraseña con la longitud mínima', () => {
    expect(validatePassword('123456')).toBeNull();
  });

  it('acepta una contraseña válida con caracteres especiales', () => {
    expect(validatePassword('Clave!6')).toBeNull();
  });
});
