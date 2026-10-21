import { integrationsApi } from "@/api/contract";
import type {
  CredentialDraft,
  CredentialStepUp,
  Integration,
  IntegrationPolicy,
  IssuedIntegrationSecret,
} from "@/types/integration";

const REQUEST_TIMEOUT_MS = 30_000;

// The wire contract has nullable timestamp strings; older generated models use object.
// Keep that compatibility boundary here rather than casting data inside components.
interface ApiIntegration {
  id: string;
  name: string;
  status: string;
  created_at: string;
  created_by: { id: string; name: string };
  credentials: Array<{
    id: string;
    token_prefix: string;
    status: string;
    created_at: string;
    expires_at: string;
    revoked_at: string | null;
    last_used_at: string | null;
    scopes: string[];
    category_allowlist_enabled: boolean;
    category_ids: string[];
    payment_source_allowlist_enabled: boolean;
    payment_source_ids: string[];
    cidr_allowlist_enabled: boolean;
    allowed_cidrs: string[];
  }>;
}

function mapIntegration(item: ApiIntegration): Integration {
  return {
    id: item.id,
    name: item.name,
    status: item.status,
    createdAt: item.created_at,
    createdBy: { id: item.created_by.id, name: item.created_by.name },
    credentials: item.credentials.map((credential) => ({
      id: credential.id,
      tokenPrefix: credential.token_prefix,
      status: credential.status,
      createdAt: credential.created_at,
      expiresAt: credential.expires_at,
      revokedAt: credential.revoked_at,
      lastUsedAt: credential.last_used_at,
      scopes: [...credential.scopes],
      categoryAllowlistEnabled: credential.category_allowlist_enabled,
      categoryIds: [...credential.category_ids],
      paymentSourceAllowlistEnabled:
        credential.payment_source_allowlist_enabled,
      paymentSourceIds: [...credential.payment_source_ids],
      cidrAllowlistEnabled: credential.cidr_allowlist_enabled,
      allowedCidrs: [...credential.allowed_cidrs],
    })),
  };
}

function policyBody(policy: IntegrationPolicy) {
  return {
    scopes: policy.scopes,
    category_allowlist_enabled: policy.categoryAllowlistEnabled,
    category_ids: policy.categoryAllowlistEnabled ? policy.categoryIds : [],
    payment_source_allowlist_enabled: policy.paymentSourceAllowlistEnabled,
    payment_source_ids: policy.paymentSourceAllowlistEnabled
      ? policy.paymentSourceIds
      : [],
    cidr_allowlist_enabled: policy.cidrAllowlistEnabled,
    allowed_cidrs: policy.cidrAllowlistEnabled ? policy.allowedCidrs : [],
  };
}

function stepUpBody(stepUp: CredentialStepUp) {
  return {
    current_password: stepUp.currentPassword,
    two_factor_token: stepUp.twoFactorToken || undefined,
  };
}

function mapSecret(data: {
  token: string;
  token_prefix: string;
  expires_at: string;
}): IssuedIntegrationSecret {
  return {
    token: data.token,
    tokenPrefix: data.token_prefix,
    expiresAt: data.expires_at,
  };
}

export async function listIntegrationCredentials(
  workspaceId: string,
  signal: AbortSignal,
) {
  const response = await integrationsApi.integrationManagementControllerList(
    workspaceId,
    { signal, timeout: REQUEST_TIMEOUT_MS },
  );
  return (response.data as unknown as ApiIntegration[]).map(mapIntegration);
}

// Issuance calls intentionally use plain async functions, outside React Query.
export async function createIntegrationCredential(
  workspaceId: string,
  draft: CredentialDraft,
  stepUp: CredentialStepUp,
  signal: AbortSignal,
) {
  const response = await integrationsApi.integrationManagementControllerCreate(
    workspaceId,
    {
      name: draft.name,
      expires_at: draft.expiresAt,
      ...policyBody(draft),
      ...stepUpBody(stepUp),
    },
    { signal, timeout: REQUEST_TIMEOUT_MS },
  );
  return mapSecret(response.data);
}

export async function rotateIntegrationCredential(
  workspaceId: string,
  integrationId: string,
  credentialId: string,
  draft: CredentialDraft,
  stepUp: CredentialStepUp,
  signal: AbortSignal,
) {
  // The server permits policy replacement on rotation; pass an explicit complete policy.
  const body = {
    expires_at: draft.expiresAt,
    ...policyBody(draft),
    ...stepUpBody(stepUp),
  };
  const response = await integrationsApi.integrationManagementControllerRotate(
    integrationId,
    credentialId,
    workspaceId,
    body,
    { signal, timeout: REQUEST_TIMEOUT_MS },
  );
  return mapSecret(response.data);
}

export async function revokeIntegrationCredential(
  workspaceId: string,
  integrationId: string,
  credentialId: string,
  stepUp: CredentialStepUp,
  signal: AbortSignal,
) {
  await integrationsApi.integrationManagementControllerRevoke(
    integrationId,
    credentialId,
    workspaceId,
    stepUpBody(stepUp),
    { signal, timeout: REQUEST_TIMEOUT_MS },
  );
}

export async function deleteIntegrationCredential(
  workspaceId: string,
  integrationId: string,
  credentialId: string,
  signal: AbortSignal,
) {
  await integrationsApi.integrationManagementControllerRemove(
    integrationId,
    credentialId,
    workspaceId,
    { signal, timeout: REQUEST_TIMEOUT_MS },
  );
}
