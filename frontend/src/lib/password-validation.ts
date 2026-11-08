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
  "123456789012345",
  "1234567890123456",
  "passwordpassword",
  "qwertyuiopasdfgh",
];

export function passwordValidationRules(t: TFunction) {
  return {
    validate: {
      length: (value: string) =>
        Array.from(value).length >= 15 || t("auth.minPassword"),
      uncommon: (value: string) =>
        !COMMON_PASSWORD_PATTERNS.some(
          (password) => value.toLowerCase() === password,
        ) || t("auth.passwordTooCommon"),
    },
  };
}
