import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { defaultLocale, locales, resolveLocale } from "@monqom/ui/locales";
import { enHelp, plHelp } from "./resources/help";
import type { TranslationShape } from "./resources/types";
import { enCore, plCore } from "./resources/core";
import { enAuth, plAuth } from "./resources/auth";
import { enDashboard, plDashboard } from "./resources/dashboard";
import { enTransactions, plTransactions } from "./resources/transactions";
import { enBudgets, plBudgets } from "./resources/budgets";
import { enGoals, plGoals } from "./resources/goals";
import { enSettings, plSettings } from "./resources/settings";
import {
  enPaymentSources,
  plPaymentSources,
} from "./resources/payment-sources";
import { enCategories, plCategories } from "./resources/categories";
import {
  enCategoryManagement,
  plCategoryManagement,
} from "./resources/category-management";

const en = {
  ...enCore,
  ...enHelp,
  ...enAuth,
  ...enDashboard,
  ...enTransactions,
  ...enBudgets,
  ...enGoals,
  ...enSettings,
  ...enPaymentSources,
  ...enCategories,
  ...enCategoryManagement,
} as const;

type TranslationKeyOf<T> = {
  [Key in keyof T & string]: T[Key] extends string
    ? Key
    : T[Key] extends Readonly<Record<string, unknown>>
      ? `${Key}.${TranslationKeyOf<T[Key]>}`
      : never;
}[keyof T & string];

export type AppTranslationKey = TranslationKeyOf<typeof en>;

const pl = {
  ...plCore,
  ...plHelp,
  ...plAuth,
  ...plDashboard,
  ...plTransactions,
  ...plBudgets,
  ...plGoals,
  ...plSettings,
  ...plPaymentSources,
  ...plCategories,
  ...plCategoryManagement,
} as const satisfies TranslationShape<typeof en>;

export const defaultNS = "translation" as const;
export const resources = {
  en: { [defaultNS]: en },
  pl: { [defaultNS]: pl },
} as const;

const initialLanguage = resolveLocale(
  localStorage.getItem("monqom-language"),
  navigator.language,
);

void i18n.use(initReactI18next).init({
  resources,
  defaultNS,
  lng: initialLanguage,
  fallbackLng: defaultLocale,
  supportedLngs: Object.keys(locales),
  interpolation: { escapeValue: false },
  returnNull: false,
});

document.documentElement.lang = initialLanguage;
document.title =
  initialLanguage === "pl"
    ? "Monqom - finanse osobiste bez chaosu"
    : "Monqom - personal finance, made clear";

i18n.on("languageChanged", (language) => {
  const supportedLanguage = resolveLocale(language, defaultLocale);
  localStorage.setItem("monqom-language", supportedLanguage);
  document.documentElement.lang = supportedLanguage;
  document.title =
    supportedLanguage === "pl"
      ? "Monqom - finanse osobiste bez chaosu"
      : "Monqom - personal finance, made clear";
});

window.addEventListener("storage", (event) => {
  if (event.key === "monqom-language") {
    const language = resolveLocale(event.newValue, navigator.language);
    if (language !== i18n.resolvedLanguage) void i18n.changeLanguage(language);
  }
});

export default i18n;
