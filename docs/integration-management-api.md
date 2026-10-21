# Integration credential management API

For the settings workflow and client-side operational guidance, see
[the integration client guide](integration-client-guide.md).

Workspace owners and administrators use these endpoints to manage unattended clients. The API
uses human browser sessions. Integration bearer credentials cannot manage themselves or inherit
human workspace permissions. The prefix is `/api/v1`; `W`, `I` and `C` below are workspace,
integration and credential-version IDs.

## Authentication and authorization

Every route requires a valid `monqom.sid` session cookie and workspace role `owner` or `admin`.
An ordinary member receives `403`; a non-member receives the same `404` as a missing workspace.
Missing, foreign and safely deleted targets return `404` without revealing metadata.
A bearer token alone never satisfies session authentication.

Every POST and DELETE also requires the session's `x-csrf-token` header from the existing browser
authentication flow. Invalid/absent CSRF protection returns `403`, code `CSRF_TOKEN_INVALID`,
before the handler runs. These routes never bypass CSRF.

Create, rotate and revoke verify the current password on every request, plus a current TOTP or
unused recovery code when 2FA is enabled. Verification is immediate and must finish within five
minutes; there is no caller-provided timestamp or reusable step-up grant. List, get and safe-delete
require the session and role without password step-up.

After session, workspace and role checks, create, rotate and revoke consume one shared
attempt budget: five requests per human account and twenty per source IP in a rolling fifteen-minute
window before verifying the password or second factor, including successful requests and malformed DTOs. The account budget spans workspaces,
sessions and all three operations. Source IPs follow the application's trusted-proxy configuration.
Limits use the existing integration rate-limit storage and database clock across backend replicas.
Exceeding either limit returns `429`, code `RATE_LIMITED`, with `Retry-After` in seconds; unavailable
limit storage returns `503`. Both are audited without performing the requested mutation.

Management responses set `Cache-Control: no-store` and `Pragma: no-cache`. Send passwords and second
factors only in their JSON fields, never in URLs. Use HTTPS and keep issued bearer tokens in the
client's secret store.

## Routes and outcomes

| Operation   | Method and path                                          | Success                                                | Additional errors                                                                                           |
| ----------- | -------------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Create      | `POST /workspaces/W/integrations`                        | `201`, `IssuedIntegrationCredentialResponseDto`        | `400` invalid policy; `401` failed step-up; `403` authority lost; `409` transaction conflict                |
| List        | `GET /workspaces/W/integrations`                         | `200`, `IntegrationResponseDto[]` (possibly empty)     | Shared errors below                                                                                         |
| Get         | `GET /workspaces/W/integrations/I`                       | `200`, `IntegrationResponseDto`                        | `404` hidden or unavailable integration                                                                     |
| Rotate      | `POST /workspaces/W/integrations/I/credentials/C/rotate` | `200`, `RotatedIntegrationCredentialResponseDto`       | `400` invalid replacement policy; `401` failed step-up; `409` expired/revoked version or lifecycle conflict |
| Revoke      | `POST /workspaces/W/integrations/I/credentials/C/revoke` | `200`, `{ "revoked": true }` or `{ "revoked": false }` | `401` failed step-up; `409` transaction conflict                                                            |
| Safe-delete | `DELETE /workspaces/W/integrations/I/credentials/C`      | `200`, `{ "deleted": true }`                           | `409` version has not been revoked                                                                          |

Shared errors are `400` for malformed input/unknown DTO properties, `401` for missing/invalid human
authentication, `403` for insufficient role or CSRF, `404` for inaccessible workspace or target,
and `503` when authoritative persistence or mandatory audit is unavailable. Concurrent transactions
can return `409` without committing their mutation. Body parsers or proxies may reject malformed
or oversized requests before controller processing.
High-risk create, rotate and revoke operations can also return `429` as described above.

Errors use the application's envelope:

```json
{
  "statusCode": 400,
  "message": "A resource restriction is invalid or archived",
  "error": "Bad Request",
  "code": "VALIDATION_ERROR"
}
```

`message` may be an array of validation messages. Codes are `VALIDATION_ERROR` (400),
`AUTHENTICATION_REQUIRED` (401), `ACCESS_DENIED` (403), `RESOURCE_NOT_FOUND` (404), `CONFLICT` (409),
`RATE_LIMITED` (429), and `SERVICE_UNAVAILABLE` (503), except the CSRF-specific code above. These endpoints do not return
secrets, digests, submitted policy values in error text, or stacks.

## Create request

`CreateIntegrationCredentialDto` accepts only:

| Field                              | Required         | Rules                                                                                                                                                 |
| ---------------------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`                             | Yes              | Trimmed string, 1–100 characters, not whitespace alone                                                                                                |
| `expires_at`                       | Yes              | Valid ISO date-time with `Z` or explicit UTC offset, seconds and optional 1–3 fractional digits; future instant, at most 365 × 24 hours from issuance |
| `scopes`                           | Yes              | Array of distinct exact scopes below; `[]` grants no machine operation                                                                                |
| `category_allowlist_enabled`       | Yes              | `false` explicitly permits any active category in this workspace; `true` enables `category_ids`                                                       |
| `category_ids`                     | No               | Up to 200 distinct nonempty IDs, each at most 128 characters; defaults to `[]`                                                                        |
| `payment_source_allowlist_enabled` | Yes              | Boolean with the same policy for payment sources                                                                                                      |
| `payment_source_ids`               | No               | Up to 200 distinct nonempty IDs, each at most 128 characters; defaults to `[]`                                                                        |
| `cidr_allowlist_enabled`           | No               | Boolean, defaults to `false`                                                                                                                          |
| `allowed_cidrs`                    | No               | Up to 64 distinct IPv4/IPv6 CIDRs, each at most 64 characters; defaults to `[]`                                                                       |
| `current_password`                 | Yes              | Current human password, 1–1024 characters; never retained or audited                                                                                  |
| `two_factor_token`                 | When 2FA enabled | Current TOTP or unused recovery code, 1–128 characters                                                                                                |

Optional properties may be omitted but cannot be `null`. Unknown fields are rejected. IDs cannot
contain whitespace. Every category/source ID must be active and belong to `W`. Nonempty IDs or
CIDRs with the corresponding allowlist disabled return `400`. An enabled empty list permits no
resource/address of that type. Restrictions narrow permissions: they never grant scopes or allow
foreign-workspace resources. CIDRs are normalized before persistence.

Exact, case-sensitive, independent scopes:

- `transactions:create`
- `transactions:read-own`
- `transactions:update-own`
- `transactions:delete-own`
- `categories:read`
- `payment-sources:read`

There are no wildcard, implied, full-access or non-expiring options. Both resource policies must
be explicit even for empty scopes or metadata-only access.

The complete policy is validated before creation. Resource rows are revalidated and locked in the
transaction that creates the integration, its first credential and lifecycle audit events. Invalid
policy leaves no partial integration, credential or successful issuance event; its separate denial
may still be audited.

The `201` response contains `integration_id`, `credential_id`, `token`, `token_prefix` and
`expires_at`. `token` is the full bearer secret, revealed exactly once after commit. A lost issuance
response cannot be recovered through get/list: rotate the credential instead.

## List and get responses

`IntegrationResponseDto` contains `id`, `name`, `status`, `created_at`, `created_by: { id, name }` and
`credentials`. Deleted creators keep their durable reference and display as `Deleted user`.
Integration and credential collections are ordered newest first, with IDs breaking timestamp ties.

Each `IntegrationCredentialResponseDto` contains only:

- `id`, `token_prefix`, `status`, `created_at`, `expires_at`, `revoked_at`, `last_used_at`;
- `scopes`, `category_allowlist_enabled`, `category_ids`;
- `payment_source_allowlist_enabled`, `payment_source_ids`;
- `cidr_allowlist_enabled`, `allowed_cidrs`.

Stored status is `active` or `revoked`. An `active` version past `expires_at` cannot authenticate or
rotate; use expiry alongside status when showing effective state. Management reads do not select
full tokens, digests or last-used source IPs. Safely deleted versions are omitted; an integration
with no remaining visible version is hidden as well.

## Rotate request

`RotateIntegrationCredentialDto` requires `expires_at`, `current_password` and, when 2FA is enabled,
`two_factor_token`, with creation's validation rules. It optionally accepts `scopes` and the
resource/CIDR policy fields above. It does not accept names or identity fields.

Omit `scopes` to preserve them; `[]` removes all capabilities. For each resource type, omit both
its flag and list to preserve policy. To replace policy, send an explicit flag with the new list
(an omitted list means `[]`). A list without its flag returns `400`. Retained and replacement IDs
are validated again: replace a policy containing archived IDs before rotation can succeed.

Rotation serializes against revocation, safe deletion and loss of creator authority. It revokes
the old version and creates exactly one replacement in one transaction with audit, without overlap.
Of two rotations of the same version, only one can succeed; the loser gets `409` without an orphan.
Expired/revoked versions cannot rotate or reactivate.

The response contains `credential_id`, `token`, `token_prefix` and `expires_at`. It reveals the new
secret once. Integration identity, creator and transaction ownership are preserved. Scopes and
resource/network policies are preserved unless explicitly replaced.

## Revoke and safe-delete

Revoke accepts only `CredentialStepUpDto`: `current_password` and optional `two_factor_token`.
The first successful call returns `{ "revoked": true }`. A repeat on the same visible revoked
version returns `{ "revoked": false }` without changing its state and is still audited.
Revocation is immediate and irreversible, including for expired versions, and deletes no financial
data. Authentication starting after commit fails; an already authenticated request may finish.

Safe-delete has no request DTO. The target must already be revoked; expiration alone is insufficient.
It records `deleted_at` and retains the version, safe prefix, digest, policy, lifecycle times and
audit evidence. It never deletes financial transactions. Removing the last visible version hides
its integration without changing durable transaction ownership. Further operations return `404`.

Lifecycle mutations and their audit events commit together. Audit records include the actual
human actor, workspace, integration/version, safe prefix, previous/new status and policy (including
expiry), time and bounded reason. They exclude tokens, digests, passwords, second factors, raw
body/query contents and source IPs. Read and denied management attempts, including step-up and CSRF
failures, are also audited. Unknown/foreign target IDs from requests are not copied into audit
metadata. Required audit failure fails closed and rolls back lifecycle mutations.

See [the credential security decision](adr/0002-workspace-integration-credentials.md) and
[the machine transaction API](external-transactions-api.md) for the separate machine contract.
