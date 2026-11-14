/** Languages available in the app and the public help center. */
export const locales = {
  en: { label: "English", lang: "en" },
  pl: { label: "Polski", lang: "pl" },
} as const;

export type Locale = keyof typeof locales;
export const defaultLocale: Locale = "en";

export function resolveLocale(stored: string | null, browser: string): Locale {
  if (stored && Object.hasOwn(locales, stored)) return stored as Locale;
  const browserLanguage = browser.toLowerCase().split("-")[0];
  return browserLanguage && Object.hasOwn(locales, browserLanguage)
    ? (browserLanguage as Locale)
    : defaultLocale;
}
