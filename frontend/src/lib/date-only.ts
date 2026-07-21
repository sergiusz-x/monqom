import { getIntlLocale } from "@/lib/locale";

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

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

export function formatDateOnly(
  value: string,
  options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
  },
): string {
  const normalized = normalizeDateOnly(value);
  if (!normalized) return value;
  const [year, month, day] = normalized.split("-").map(Number);
  return new Intl.DateTimeFormat(getIntlLocale(), {
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

export function formatLongDate(value: string): string {
  return formatDateOnly(value, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function getDateOnlyInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

export function getMonthInTimeZone(date: Date, timeZone: string): string {
  return getDateOnlyInTimeZone(date, timeZone).slice(0, 7);
}

export function shiftMonth(month: string, delta: number): string {
  const [year, monthPart] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthPart - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function formatMonthName(
  month: string,
  monthStyle: "short" | "long",
  includeYear: boolean,
): string {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return month;
  const [year, monthPart] = month.split("-").map(Number);
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
  const [year, monthPart] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, monthPart, 0)).getUTCDate();
  return {
    dateFrom: `${month}-01`,
    dateTo: `${month}-${String(lastDay).padStart(2, "0")}`,
  };
}
