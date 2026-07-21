import type { PaymentSource, PaymentSourceType } from "@/types/payment-source";
import type { TFunction } from "i18next";
import type { AppTranslationKey } from "@/i18n";

export const PAYMENT_SOURCE_TYPES: readonly PaymentSourceType[] = [
  "cash",
  "bank",
  "debit_card",
  "credit_card",
  "other",
];

const PAYMENT_SOURCE_TYPE_KEYS: Record<PaymentSourceType, AppTranslationKey> = {
  cash: "paymentSources.types.cash",
  bank: "paymentSources.types.bank",
  debit_card: "paymentSources.types.debit_card",
  credit_card: "paymentSources.types.credit_card",
  other: "paymentSources.types.other",
};

export function paymentSourceName(
  source: Pick<PaymentSource, "name" | "systemKey">,
  translate: TFunction,
): string {
  return source.systemKey === "cash"
    ? translate("paymentSources.systemCash")
    : source.name;
}

export function paymentSourceTypeLabel(
  type: PaymentSourceType,
  translate: TFunction,
): string {
  return translate(PAYMENT_SOURCE_TYPE_KEYS[type]);
}
