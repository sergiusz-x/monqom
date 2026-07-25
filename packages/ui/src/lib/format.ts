// Format utilities for locale-aware currency, date, and number formatting.
// Uses Intl APIs and respects workspace locale/timezone settings if available.

/**
 * Retrieve the locale from workspace settings (if available) or fallback to
 * navigator.language or document.documentElement.lang or en-US.
 */
export function getLocale(): string {
  // If a global workspace settings object is present (e.g., injected by server)
  if (typeof window !== 'undefined' && window.__WORKSPACE_SETTINGS__) {
    const locale = window.__WORKSPACE_SETTINGS__.locale;
    if (locale) return locale;
  }
  // Otherwise, try the HTML lang attribute (often set by server-side rendering)
  if (typeof document !== 'undefined' && document.documentElement.lang) {
    return document.documentElement.lang;
  }
  // Fallback to navigator.language
  if (typeof navigator !== 'undefined' && navigator.language) {
    return navigator.language;
  }
  return 'en-US';
}

/**
 * Retrieve the timezone from workspace settings (if available) or fallback to
 * the environment's timezone.
 */
export function getTimezone(): string {
  if (typeof window !== 'undefined' && window.__WORKSPACE_SETTINGS__) {
    const tz = window.__WORKSPACE_SETTINGS__.timezone;
    if (tz) return tz;
  }
  // Fallback to the environment's timezone
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Format a number as a currency string using Intl.NumberFormat.
 * @param value - The numeric value to format.
 * @param currency - ISO 4217 currency code (e.g., 'USD', 'EUR').
 * @param locale - BCP 47 language tag; if omitted, uses getLocale().
 * @returns Formatted currency string.
 */
export function formatCurrency(
  value: number,
  currency: string = 'USD',
  locale: string = getLocale()
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(value);
}

/**
 * Format a date using Intl.DateTimeFormat.
 * Respects workspace timezone via getTimezone() unless overridden in options.
 * @param date - Date object or timestamp.
 * @param options - Intl.DateTimeFormat options.
 * @param locale - BCP 47 language tag; if omitted, uses getLocale().
 * @returns Formatted date string.
 */
export function formatDate(
  date: Date | string | number,
  options: Intl.DateTimeFormatOptions = {},
  locale: string = getLocale()
): string {
  const opts = { ...options };
  if (!('timeZone' in opts)) {
    opts.timeZone = getTimezone();
  }
  return new Intl.DateTimeFormat(locale, opts).format(new Date(date));
}

/**
 * Format a number using Intl.NumberFormat.
 * @param value - The numeric value to format.
 * @param options - Intl.NumberFormat options.
 * @param locale - BCP 47 language tag; if omitted, uses getLocale().
 * @returns Formatted number string.
 */
export function formatNumber(
  value: number,
  options: Intl.NumberFormatOptions = {},
  locale: string = getLocale()
): string {
  return new Intl.NumberFormat(locale, options).format(value);
}
