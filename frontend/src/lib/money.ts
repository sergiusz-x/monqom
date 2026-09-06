import {
  digitsToMinorUnits,
  formatCurrency as formatUiCurrency,
  formatMinorUnits as formatUiMinorUnits,
  majorAmountToMinorUnits,
  minorUnitsToMajorAmount,
} from "@monqom/ui";
import { getIntlLocale } from "@/lib/locale";

export { digitsToMinorUnits, majorAmountToMinorUnits, minorUnitsToMajorAmount };

const FINANCIAL_FRACTION_DIGITS = {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
} as const;

/** Application adapter: shared formatting plus the currently selected UI locale. */
export function formatCurrency(amount: number, currency: string): string {
  return formatUiCurrency(
    amount,
    currency,
    getIntlLocale(),
    FINANCIAL_FRACTION_DIGITS,
  );
}

export function formatMinorUnits(
  minorUnits: number | null,
  locale = getIntlLocale(),
): string {
  return formatUiMinorUnits(minorUnits, locale);
}
