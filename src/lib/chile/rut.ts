import { format, validate } from 'rut.js';

export function formatRut(value: string): string {
  const compactValue = value.replace(/[^0-9kK]/g, '').slice(0, 9).toUpperCase();
  if (compactValue.length < 8) return compactValue;
  return format(compactValue, { dots: false }).toUpperCase();
}

export function normalizeRut(value: string): string | null {
  const trimmedValue = value.trim();
  if (!trimmedValue) return null;
  if (!validate(trimmedValue)) return null;

  return formatRut(trimmedValue);
}

export function isValidRut(value: string): boolean {
  return normalizeRut(value) !== null;
}
