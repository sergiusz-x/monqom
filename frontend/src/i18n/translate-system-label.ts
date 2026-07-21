import type { TFunction } from "i18next";
import i18n, { type AppTranslationKey } from "@/i18n";

/**
 * Translates a server-provided system key only when it exists in the bundled
 * resources. User-defined and unknown values always retain their API label.
 */
export function translateSystemLabel(
  t: TFunction,
  systemKey: string | null | undefined,
  fallback: string,
): string {
  if (!systemKey || !i18n.exists(systemKey)) return fallback;

  return t(systemKey as AppTranslationKey, { defaultValue: fallback });
}
