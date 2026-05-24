const CHILE_MOBILE_PATTERN = /^\+569[0-9]{8}$/;

export function normalizeChileMobilePhone(value: string): string | null {
  const trimmedValue = value.trim();
  if (!trimmedValue) return null;

  const compactValue = trimmedValue.replace(/[\s()-]/g, '');

  if (CHILE_MOBILE_PATTERN.test(compactValue)) {
    return compactValue;
  }

  if (/^9[0-9]{8}$/.test(compactValue)) {
    return `+56${compactValue}`;
  }

  if (/^569[0-9]{8}$/.test(compactValue)) {
    return `+${compactValue}`;
  }

  return null;
}

export function isValidChileMobilePhone(value: string): boolean {
  return normalizeChileMobilePhone(value) !== null;
}
