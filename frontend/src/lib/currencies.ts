export const SUPPORTED_CURRENCIES = [
  "PLN",
  "EUR",
  "USD",
  "GBP",
  "CHF",
  "CZK",
  "SEK",
  "NOK",
  "DKK",
  "HUF",
  "RON",
] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export function isSupportedCurrency(
  value: unknown,
): value is SupportedCurrency {
  return (
    typeof value === "string" &&
    SUPPORTED_CURRENCIES.includes(value as SupportedCurrency)
  );
}
