import { getIntlLocale } from "@/lib/locale";

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const YEAR_MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function normalizeDateOnly(value: string): string | null {
  const candidate = value.slice(0, 10);
  const match = DATE_ONLY_PATTERN.exec(candidate);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return candidate;
}

export function parseDateOnlyParts(
  value: string,
): [year: number, month: number, day: number] | null {
  const normalized = normalizeDateOnly(value);
  if (!normalized) return null;
  return [
    Number(normalized.slice(0, 4)),
    Number(normalized.slice(5, 7)),
    Number(normalized.slice(8, 10)),
  ];
}

export function parseYearMonth(
  value: string,
): [year: number, month: number] | null {
  if (!YEAR_MONTH_PATTERN.test(value)) return null;
  return [Number(value.slice(0, 4)), Number(value.slice(5, 7))];
}

export function formatDateOnly(
  value: string,
  options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
  },
  locale: string = getIntlLocale(),
): string {
  const parts = parseDateOnlyParts(value);
  if (!parts) return value;
  const [year, month, day] = parts;
  return new Intl.DateTimeFormat(locale, {
    ...options,
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function formatShortDate(value: string): string {
  return formatDateOnly(value, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatLongDate(value: string, locale?: string): string {
  return formatDateOnly(
    value,
    {
      year: "numeric",
      month: "long",
      day: "numeric",
    },
    locale,
  );
}

export function getDateOnlyInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  const year = values.get("year");
  const month = values.get("month");
  const day = values.get("day");

  if (!year || !month || !day) {
    throw new Error(
      "Intl.DateTimeFormat did not provide a complete calendar date",
    );
  }

  return `${year}-${month}-${day}`;
}

export function getMonthInTimeZone(date: Date, timeZone: string): string {
  return getDateOnlyInTimeZone(date, timeZone).slice(0, 7);
}

export function shiftMonth(month: string, delta: number): string {
  const parts = parseYearMonth(month);
  if (!parts) return month;
  const [year, monthPart] = parts;
  const date = new Date(Date.UTC(year, monthPart - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function formatMonthName(
  month: string,
  monthStyle: "short" | "long",
  includeYear: boolean,
): string {
  const parts = parseYearMonth(month);
  if (!parts) return month;
  const [year, monthPart] = parts;
  return new Intl.DateTimeFormat(getIntlLocale(), {
    month: monthStyle,
    year: includeYear ? "numeric" : undefined,
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, monthPart - 1, 1)));
}

export function formatMonth(month: string): string {
  return formatMonthName(month, "long", true);
}

export function formatShortMonth(month: string): string {
  return formatMonthName(month, "short", false);
}

export function getMonthDateRange(month: string): {
  dateFrom: string;
  dateTo: string;
} {
  const parts = parseYearMonth(month);
  if (!parts) throw new RangeError("Expected a valid YYYY-MM month");
  const [year, monthPart] = parts;
  const lastDay = new Date(Date.UTC(year, monthPart, 0)).getUTCDate();
  return {
    dateFrom: `${month}-01`,
    dateTo: `${month}-${String(lastDay).padStart(2, "0")}`,
  };
}
