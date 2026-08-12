export const MIN_PASSWORD_LENGTH = 6;

export function validatePassword(password: string): string | null {
  if (!password) return 'La nueva contraseña es obligatoria.';
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `La nueva contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  }
  return null;
}
