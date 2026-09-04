import {
  digitsToMinorUnits,
  formatCurrency as formatUiCurrency,
  formatMinorUnits as formatUiMinorUnits,
  majorAmountToMinorUnits,
  minorUnitsToMajorAmount,
} from "@monqom/ui";
import { getIntlLocale } from "@/lib/locale";

export { digitsToMinorUnits, majorAmountToMinorUnits, minorUnitsToMajorAmount };

/** Application adapter: shared formatting plus the currently selected UI locale. */
export function formatCurrency(amount: number, currency: string): string {
  return formatUiCurrency(amount, currency, getIntlLocale());
}

export function formatMinorUnits(
  minorUnits: number | null,
  locale = getIntlLocale(),
): string {
  return formatUiMinorUnits(minorUnits, locale);
}
