import type { TFunction } from "i18next";

const COMMON_PASSWORD_PATTERNS = [
  "password",
  "qwerty",
  "letmein",
  "welcome",
  "admin",
  "monkey",
  "football",
  "abc123",
  "iloveyou",
];

export function passwordValidationRules(t: TFunction) {
  return {
    minLength: { value: 16, message: t("auth.minPassword") },
    validate: {
      uppercase: (value: string) =>
        /[A-Z]/.test(value) || t("auth.passwordUppercase"),
      number: (value: string) => /\d/.test(value) || t("auth.passwordNumber"),
      specialCharacter: (value: string) =>
        /[^A-Za-z0-9]/.test(value) || t("auth.passwordSpecialCharacter"),
      uncommon: (value: string) => {
        const normalized = value.toLowerCase().replace(/[^a-z0-9]/g, "");
        return (
          !COMMON_PASSWORD_PATTERNS.some((pattern) =>
            normalized.includes(pattern),
          ) || t("auth.passwordTooCommon")
        );
      },
    },
  };
}
