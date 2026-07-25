/**
 * Money utilities – pure functions for converting between minor-unit integers
 * (e.g. cents) and the display/API representations.
 *
 * All arithmetic is done with integer maths to avoid floating-point errors.
 */

import { formatCurrency } from './format';

/**
 * Convert a major-amount string/number (e.g. "12.50" or 12.5) to minor units
 * (e.g. 1250). Returns null if the value is not a valid two-decimal number.
 */
export function majorAmountToMinorUnits(value: number | string): number | null {
  const normalized =
    typeof value === 'number'
      ? Number.isFinite(value)
        ? value.toFixed(2)
        : ''
      : value.trim();
  const match = /^(\d+)(?:\\.(\d{1,2}))?$/.exec(normalized);
  if (!match) return null;

  const whole = Number(match[1]);
  const fraction = Number((match[2] ?? '').padEnd(2, '0') || '0');
  const minorUnits = whole * 100 + fraction;
  return Number.isSafeInteger(minorUnits) ? minorUnits : null;
}

/** Convert minor units (e.g. 1250) back to a major-amount number (e.g. 12.50). */
export function minorUnitsToMajorAmount(minorUnits: number): number {
  if (!Number.isSafeInteger(minorUnits)) {
    throw new RangeError('Money minor units must be a safe integer');
  }
  const sign = minorUnits < 0 ? '-' : '';
  const absoluteMinorUnits = Math.abs(minorUnits);
  return Number(
    `${sign}${Math.trunc(absoluteMinorUnits / 100)}.${String(absoluteMinorUnits % 100).padStart(2, '0')}`
  );
}

/** Format minor units for display in an input (e.g. 1250 → "12.50"). */
export function formatMinorUnits(
  minorUnits: number | null,
  locale?: string,
): string {
  if (minorUnits === null) return '';
  return new Intl.NumberFormat(locale ?? undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true,
  }).format(minorUnits / 100);
}

/** Strip non-digit characters from a string and return the numeric minor units. */
export function digitsToMinorUnits(value: string): number | null {
  const digits = value.replace(/\\D/g, '').replace(/^0+(?=\\d)/, '');
  if (!digits) return null;
  const minorUnits = Number(digits);
  return Number.isSafeInteger(minorUnits) ? minorUnits : null;
}
