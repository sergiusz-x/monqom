import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import type { TranslationShape } from "./resources/types";
import { enCore, plCore } from "./resources/core";
import { enAuth, plAuth } from "./resources/auth";
import { enDashboard, plDashboard } from "./resources/dashboard";
import { enTransactions, plTransactions } from "./resources/transactions";
import { enBudgets, plBudgets } from "./resources/budgets";
import { enSettings, plSettings } from "./resources/settings";
import {
  enPaymentSources,
  plPaymentSources,
} from "./resources/payment-sources";
import { enCategories, plCategories } from "./resources/categories";

const en = {
  ...enCore,
  ...enAuth,
  ...enDashboard,
  ...enTransactions,
  ...enBudgets,
  ...enSettings,
  ...enPaymentSources,
  ...enCategories,
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
  ...plAuth,
  ...plDashboard,
  ...plTransactions,
  ...plBudgets,
  ...plSettings,
  ...plPaymentSources,
  ...plCategories,
} as const satisfies TranslationShape<typeof en>;

export const defaultNS = "translation" as const;
export const resources = {
  en: { [defaultNS]: en },
  pl: { [defaultNS]: pl },
} as const;

const storedLanguage = localStorage.getItem("monqom-language");
const initialLanguage =
  storedLanguage === "pl" || storedLanguage === "en"
    ? storedLanguage
    : navigator.language.toLowerCase().startsWith("pl")
      ? "pl"
      : "en";

void i18n.use(initReactI18next).init({
  resources,
  defaultNS,
  lng: initialLanguage,
  fallbackLng: "en",
  supportedLngs: ["en", "pl"],
  interpolation: { escapeValue: false },
  returnNull: false,
});

document.documentElement.lang = initialLanguage;

i18n.on("languageChanged", (language) => {
  const supportedLanguage = language === "pl" ? "pl" : "en";
  localStorage.setItem("monqom-language", supportedLanguage);
  document.documentElement.lang = supportedLanguage;
});

export default i18n;
