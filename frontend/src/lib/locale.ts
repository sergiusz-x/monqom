import i18n from "@/i18n";

export function getIntlLocale(): "pl-PL" | "en-US" {
  return i18n.resolvedLanguage === "pl" ? "pl-PL" : "en-US";
}
