import type { IntegrationScope } from "@/types/integration";

export const INTEGRATION_GUIDE_URL =
  "https://github.com/sergiusz-x/monqom/blob/main/docs/integration-client-guide.md";

export const CREDENTIAL_STATUS_COPY = {
  active: "integrations.active",
  expired: "integrations.expired",
  revoked: "integrations.statusRevoked",
  unavailable: "integrations.statusUnavailable",
} as const;

export const SCOPE_COPY = {
  "transactions:create": {
    title: "integrations.scopeCreateTitle",
    description: "integrations.scopeCreateDescription",
  },
  "transactions:update-own": {
    title: "integrations.scopeUpdateTitle",
    description: "integrations.scopeUpdateDescription",
  },
  "transactions:delete-own": {
    title: "integrations.scopeDeleteTitle",
    description: "integrations.scopeDeleteDescription",
  },
  "transactions:read-own": {
    title: "integrations.scopeReadOwnTitle",
    description: "integrations.scopeReadOwnDescription",
  },
  "categories:read": {
    title: "integrations.scopeCategoriesTitle",
    description: "integrations.scopeCategoriesDescription",
  },
  "payment-sources:read": {
    title: "integrations.scopeSourcesTitle",
    description: "integrations.scopeSourcesDescription",
  },
} as const satisfies Record<
  IntegrationScope,
  { title: string; description: string }
>;

export function knownScope(scope: string): scope is IntegrationScope {
  return Object.hasOwn(SCOPE_COPY, scope);
}

const DAY_MS = 24 * 60 * 60 * 1000;
export function localDateTime(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}
export function defaultExpiry() {
  return localDateTime(new Date(Date.now() + 90 * DAY_MS)).slice(0, 10);
}
export function maxExpiry() {
  const limit = new Date(Date.now() + 365 * DAY_MS);
  const lastDay = new Date(limit);
  // Only offer dates whose entire local day fits within the server's limit.
  lastDay.setHours(23, 59, 59, 999);
  if (lastDay.getTime() > limit.getTime())
    lastDay.setDate(lastDay.getDate() - 1);
  return localDateTime(lastDay).slice(0, 10);
}
export function expiryEndOfDay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(NaN);
  const date = new Date(`${value}T00:00:00`);
  if (
    !Number.isFinite(date.getTime()) ||
    localDateTime(date).slice(0, 10) !== value
  )
    return new Date(NaN);
  date.setHours(23, 59, 59, 999);
  return date;
}
export function validExpiry(value: string) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? expiryEndOfDay(value)
    : new Date(value);
  const lifetime = date.getTime() - Date.now();
  return Number.isFinite(lifetime) && lifetime > 0 && lifetime <= 365 * DAY_MS;
}
export function cidrLines(value: string) {
  return [
    ...new Set(
      value
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}
export function validCidr(value: string) {
  if (value.length > 64) return false;
  const match = /^([^/]+)\/(0|[1-9][0-9]{0,2})$/.exec(value);
  if (!match) return false;
  const address = match[1]!;
  const prefix = Number(match[2]);
  if (!address.includes(":")) {
    const octets = address.split(".");
    return (
      prefix <= 32 &&
      octets.length === 4 &&
      octets.every(
        (octet) => /^(0|[1-9][0-9]{0,2})$/.test(octet) && Number(octet) <= 255,
      )
    );
  }
  if (prefix > 128 || !/^[0-9a-f:.]+$/i.test(address)) return false;
  try {
    // URL's IPv6 parser validates compression, group counts and embedded IPv4, locally.
    return new URL(`http://[${address}]/`).hostname.startsWith("[");
  } catch {
    return false;
  }
}

export interface PolicyOption {
  id: string;
  label: string;
  depth?: number;
  icon?: string | null;
}
