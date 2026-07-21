import { getIntlLocale } from "@/lib/locale";

const currencyFormatters = new Map<string, Intl.NumberFormat>();

export function formatCurrency(amount: number, currency: string): string {
  const locale = getIntlLocale();
  const cacheKey = `${locale}:${currency}`;
  let formatter = currencyFormatters.get(cacheKey);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    currencyFormatters.set(cacheKey, formatter);
  }
  return formatter.format(amount);
}

export function majorAmountToMinorUnits(value: number | string): number | null {
  const normalized =
    typeof value === "number"
      ? Number.isFinite(value)
        ? value.toFixed(2)
        : ""
      : value.trim();
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(normalized);
  if (!match) return null;

  const whole = Number(match[1]);
  const fraction = Number((match[2] ?? "").padEnd(2, "0") || "0");
  const minorUnits = whole * 100 + fraction;
  return Number.isSafeInteger(minorUnits) ? minorUnits : null;
}

export function minorUnitsToMajorAmount(minorUnits: number): number {
  if (!Number.isSafeInteger(minorUnits)) {
    throw new RangeError("Money minor units must be a safe integer");
  }
  const sign = minorUnits < 0 ? "-" : "";
  const absoluteMinorUnits = Math.abs(minorUnits);
  return Number(
    `${sign}${Math.trunc(absoluteMinorUnits / 100)}.${String(absoluteMinorUnits % 100).padStart(2, "0")}`,
  );
}

export function formatMinorUnits(
  minorUnits: number | null,
  locale = getIntlLocale(),
): string {
  if (minorUnits === null) return "";
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true,
  }).format(minorUnits / 100);
}

export function digitsToMinorUnits(value: string): number | null {
  const digits = value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  if (!digits) return null;
  const minorUnits = Number(digits);
  return Number.isSafeInteger(minorUnits) ? minorUnits : null;
}
