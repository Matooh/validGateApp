import { format, validate } from 'rut.js';

export function normalizeRut(value: string): string | null {
  const trimmedValue = value.trim();
  if (!trimmedValue) return null;
  if (!validate(trimmedValue)) return null;

  return format(trimmedValue, { dots: false }).toUpperCase();
}

export function isValidRut(value: string): boolean {
  return normalizeRut(value) !== null;
}
