import i18n from "@/i18n";
import type { AppTranslationKey } from "@/i18n";

interface ApiErrorPayload {
  message?: unknown;
  code?: unknown;
}

export function getApiErrorMessage(error: unknown, fallback?: string): string {
  const payload = getApiErrorPayload(error);
  const code = typeof payload?.code === "string" ? payload.code : null;
  const translationKey = code ? ERROR_CODE_KEYS[code] : undefined;

  if (translationKey) return i18n.t(translationKey);

  const status = getApiErrorStatus(error);
  const statusKey = status === null ? null : STATUS_KEYS[status];
  if (statusKey) return i18n.t(statusKey);

  if (isNetworkError(error)) return i18n.t("apiErrors.network");

  return fallback ?? i18n.t("apiErrors.generic");
}

const ERROR_CODE_KEYS: Record<string, AppTranslationKey> = {
  INVALID_CREDENTIALS: "apiErrors.invalidCredentials",
  EMAIL_NOT_VERIFIED: "apiErrors.emailNotVerified",
  EMAIL_ALREADY_EXISTS: "apiErrors.emailAlreadyExists",
  INVALID_EMAIL_VERIFICATION_TOKEN: "apiErrors.invalidVerificationToken",
  INVALID_PASSWORD_RESET_TOKEN: "apiErrors.invalidResetToken",
  AUTHENTICATION_REQUIRED: "apiErrors.authenticationRequired",
  VALIDATION_ERROR: "apiErrors.validation",
  ACCESS_DENIED: "apiErrors.accessDenied",
  RESOURCE_NOT_FOUND: "apiErrors.notFound",
  CONFLICT: "apiErrors.conflict",
  RATE_LIMITED: "apiErrors.rateLimited",
  INTERNAL_ERROR: "apiErrors.internal",
};

const STATUS_KEYS: Partial<Record<number, AppTranslationKey>> = {
  400: "apiErrors.validation",
  401: "apiErrors.authenticationRequired",
  403: "apiErrors.accessDenied",
  404: "apiErrors.notFound",
  409: "apiErrors.conflict",
  429: "apiErrors.rateLimited",
  500: "apiErrors.internal",
};

export function getApiErrorStatus(error: unknown): number | null {
  if (
    error &&
    typeof error === "object" &&
    "response" in error &&
    error.response &&
    typeof error.response === "object" &&
    "status" in error.response &&
    typeof error.response.status === "number"
  ) {
    return error.response.status;
  }

  return null;
}

export function getApiErrorCode(error: unknown): string | null {
  const code = getApiErrorPayload(error)?.code;
  return typeof code === "string" && code.trim() ? code : null;
}

function getApiErrorPayload(error: unknown): ApiErrorPayload | null {
  if (
    error &&
    typeof error === "object" &&
    "response" in error &&
    error.response &&
    typeof error.response === "object" &&
    "data" in error.response &&
    error.response.data &&
    typeof error.response.data === "object"
  ) {
    return error.response.data as ApiErrorPayload;
  }

  return null;
}

function isNetworkError(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === "object" &&
    "request" in error &&
    !("response" in error && error.response),
  );
}
