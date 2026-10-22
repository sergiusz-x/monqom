export const INTEGRATION_SCOPES = [
  "transactions:create",
  "transactions:read-own",
  "transactions:update-own",
  "transactions:delete-own",
  "categories:read",
  "payment-sources:read",
] as const;

export type IntegrationScope = (typeof INTEGRATION_SCOPES)[number];

export interface IntegrationPolicy {
  scopes: string[];
  categoryAllowlistEnabled: boolean;
  categoryIds: string[];
  paymentSourceAllowlistEnabled: boolean;
  paymentSourceIds: string[];
  cidrAllowlistEnabled: boolean;
  allowedCidrs: string[];
}

export interface IntegrationCredential extends IntegrationPolicy {
  id: string;
  tokenPrefix: string;
  status: string;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  lastUsedAt: string | null;
}

export interface Integration {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  createdBy: { id: string; name: string };
  credentials: IntegrationCredential[];
}

/** Kept only in the mounted issuance dialog, never in a query or mutation cache. */
export interface IssuedIntegrationSecret {
  token: string;
  tokenPrefix: string;
  expiresAt: string;
}

export interface CredentialStepUp {
  currentPassword: string;
  twoFactorToken?: string;
}

export interface CredentialDraft extends IntegrationPolicy {
  name: string;
  expiresAt: string;
}

export function credentialStatus(credential: IntegrationCredential) {
  if (credential.status === "revoked") return "revoked";
  if (credential.status !== "active") return "unavailable";
  return new Date(credential.expiresAt).getTime() > Date.now()
    ? "active"
    : "expired";
}
