# Connect an external transaction client

Use an integration credential to import transactions into one workspace. It authenticates a
machine client, independently of your browser session. The examples use neutral names such as
`expense-importer` and `external-expense-123`.

Integration credentials never grant transaction listing, export, dashboard access, metadata
writes, or access to manual or another integration's transactions. The API reference below covers
both machine requests and credential management through a human session.

## Issue the smallest useful credential

1. As a workspace owner or administrator, open **Settings → Integrations → Add integration**.
2. Name the client, for example `expense-importer`, and choose an expiry. The local date and time
   are converted to an instant; expiry must be in the future and within 365 days.
3. Select individual permissions. Nothing is selected initially, and an empty selection grants
   no operation. There is no wildcard or full-access option.
4. Choose unrestricted access or specific active category and payment-source IDs. An enabled empty
   list denies every resource of that type. A category allowlist also denies uncategorized records.
   For imports that arrive without a category, choose unrestricted category access.
5. Optionally restrict source IP addresses using IPv4/IPv6 CIDRs. Use the client's outgoing public
   addresses or proxy egress, not the browser's address. IPv4 prefixes range from 0 to 32 and IPv6
   from 0 to 128; an enabled empty IP list denies every request. The backend validates this policy
   again and uses its trusted-proxy configuration to determine client addresses.
6. Review the full policy and confirm with your current password, plus a current second factor or
   unused recovery code if 2FA is enabled. Incorrect step-up credentials do not grant access.
7. Save the revealed key in the protected secret store of the runtime executing the client. The
   full value is returned only once. The dialog drops it on dismissal, navigation, workspace/account
   change, backgrounding the page, or after five minutes. Later views expose only safe metadata.

Do not put credentials in source code, environment files committed to Git, URLs, browser storage,
analytics, logs, tickets, or chat. Copy only into a trusted secret store; clear the clipboard after
use. Restrict who can read the client's secrets and redact authorization headers from diagnostics.
Never pass the credential to a browser-based transaction collection API.

If issuance times out, refresh the credential list before trying again. A server may have committed
the operation even when its response was lost. An existing full secret cannot be recovered: replace
that credential. Retrying creation blindly can create a separate integration identity.

## Choose independent scopes

| Capability                          | Required scope            | What it permits                                |
| ----------------------------------- | ------------------------- | ---------------------------------------------- |
| Create only                         | `transactions:create`     | POST a transaction owned by this integration   |
| Recover a known record and its ETag | `transactions:read-own`   | GET one exact owned `external_id`              |
| Replace an owned record             | `transactions:update-own` | PUT one exact owned `external_id`              |
| Delete an owned record              | `transactions:delete-own` | Soft-delete one exact owned `external_id`      |
| Discover category IDs               | `categories:read`         | Minimal allowed active category metadata       |
| Discover payment-source IDs         | `payment-sources:read`    | Minimal allowed active payment-source metadata |

A create-only key gets `403` for GET, PUT, DELETE, and either metadata endpoint. It cannot read back
the record it just created. A lifecycle client needs all three write scopes: create, update-own,
and delete-own. It can retain ETags returned by writes. Add read-own only if it needs to recover
an ETag by exact lookup; metadata scopes are optional when resource IDs are already configured.

Allowlists narrow each selected operation; they never add scopes or grant cross-workspace access.
Owned records outside current restrictions are inaccessible. A replacement must satisfy the policy
for both the old and new references. A narrowed policy can also prevent replay of an earlier result.

## Authenticate over HTTPS

Use a trusted HTTPS origin and verify its certificate. Never disable certificate verification or
trust forwarded-protocol headers sent by the client. The backend decides which proxies are trusted.
Send the key only as `Authorization: Bearer <credential>`. It cannot manage or rotate itself.

Requests below are illustrative HTTP messages: replace the origin, workspace/resource IDs, keys
and ETags with your own values. Do not paste real credentials into shared examples or logs. Request
paths start with `/api/v1`; the workspace ID is visible in the integration settings.

## Stateless create-only import

Send settled transactions with a stable provider-side `external_id`. Namespace IDs when importing
multiple accounts, for example `account-a:external-expense-123`. Do not derive identity from the
date, amount, or payee: two legitimate transactions may have identical financial fields.

```http
POST /api/v1/workspaces/ws_example/external-transactions HTTP/1.1
Host: monqom.example
Authorization: Bearer <credential>
Content-Type: application/json

{"external_id":"account-a:external-expense-123","type":"expense","amount":"12.34","currency":"PLN","date":"2026-09-04","description":"Imported expense","payment_source_id":"source_example"}
```

A new record returns `201` and a strong ETag such as `"tx-v1"`. A known external ID returns `200`:

```json
{ "status": "already_exists", "external_id": "account-a:external-expense-123" }
```

That acknowledgement discloses no existing financial fields, version, or deletion status. It never
overwrites, restores, or duplicates a record, even when valid submitted fields have changed. This
lets a stateless importer repeat a window of settled records. Soft-deleted IDs remain reserved.

Category and `external_id` are optional on POST; payment source is required. Missing category creates
an uncategorized record only with unrestricted category policy. The amount is a positive string
with exactly two decimal places. Without both external ID and request key, each accepted POST
creates a separate transaction; use that behavior only intentionally.

## Idempotency and lifecycle reconciliation

`Idempotency-Key` identifies a logical operation. POST may use it; PUT and DELETE require it. Use a
unique opaque 16–128 visible-ASCII-character value per operation and retain it with that request.
Reuse the same key, path, precondition and normalized body when retrying a timeout. A completed
identical retry returns its original success, snapshot and ETag, including after a later human edit.
Completed results are retained for seven days; stable external identity remains after replay expiry.

Changing an operation, external ID, expected version, or normalized body with the same retained key
returns `409`. A live concurrent claim also returns `409`, with `Retry-After: 1`; wait and repeat
the unchanged request. Concurrent identical keyed writes commit only one financial/audit effect.
A plain conflicting reuse must be corrected, not retried indefinitely.

If read-own is granted, recover exactly one owned record and its current ETag:

```http
GET /api/v1/workspaces/ws_example/external-transactions/account-a%3Aexternal-expense-123 HTTP/1.1
Authorization: Bearer <credential>
```

To replace it, use a fresh request key, its latest ETag, and a complete replacement body. The path
owns the identity; omit `external_id` from the body or keep it identical. This edits the same record.

```http
PUT /api/v1/workspaces/ws_example/external-transactions/account-a%3Aexternal-expense-123 HTTP/1.1
Authorization: Bearer <credential>
Idempotency-Key: expense-123-replace-0001
If-Match: "tx-v1"
Content-Type: application/json

{"type":"expense","amount":"12.00","currency":"PLN","date":"2026-09-04","description":"Corrected imported expense","payment_source_id":"source_example"}
```

The response is `200` with the updated record and ETag, for example `"tx-v2"`. A human edit also
advances this version. Missing `If-Match` returns `428`, malformed values return `400`, and a stale
version on an accessible owned record returns `412`. After `412`, use read-own if available, decide
whether the source is still authoritative, then send the chosen replacement with the current ETag
and a new operation key. Do not retry a stale write blindly or treat a replayed old ETag as current.

```http
DELETE /api/v1/workspaces/ws_example/external-transactions/account-a%3Aexternal-expense-123 HTTP/1.1
Authorization: Bearer <credential>
Idempotency-Key: expense-123-delete-0001
If-Match: "tx-v2"
```

Deletion returns `204` with no body and records an audited soft-delete. Repeat a timed-out deletion
with exactly its original key and ETag: the completed retry remains `204` without deleting twice.
A later unrelated lookup of a deleted record returns the same `404` as an inaccessible record.

## Metadata and denials

Optional discovery uses independent GET routes:

```http
GET /api/v1/workspaces/ws_example/external-categories HTTP/1.1
Authorization: Bearer <credential>
```

```http
GET /api/v1/workspaces/ws_example/external-payment-sources HTTP/1.1
Authorization: Bearer <credential>
```

Each returns only allowed active display metadata. Excluded or archived category parents appear
as a null parent ID. Names are for display; transaction writes must use IDs. A metadata scope does
not permit creating categories/sources or accessing any transaction operation.

For example, a create-only key calling either route receives `403`. A write proposing an excluded
source ID receives `400` without a financial effect. Exact lookup of a manual/foreign/restricted
record returns the same `404` as a missing one. Using a different workspace in the URL never grants
access or reveals its existence. Never log full credentials when diagnosing these failures.

## Errors and retry policy

| Outcome                  | Client action                                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------------------------ |
| `400`                    | Correct fields, headers or proposed references; do not retry unchanged.                                |
| `401`                    | Check expiry, revocation, IP policy and the configured secret. Do not loop on authentication failures. |
| `403`                    | Ask an owner/admin to review the exact required scope.                                                 |
| `404`                    | Treat the resource as unavailable; do not probe ownership or other workspaces.                         |
| `409` with `Retry-After` | Wait at least that many seconds and retry the identical operation.                                     |
| Other `409`              | Correct conflicting request-key reuse; do not reuse the key for changed intent.                        |
| `412` / `428`            | Recover/retain the correct ETag and choose an operation deliberately.                                  |
| `413` / `415`            | Keep JSON at or below 64 KiB and send `Content-Type: application/json`.                                |
| `429`                    | Honor `Retry-After`; use bounded exponential backoff and jitter.                                       |
| Network failure / `503`  | Treat outcome as uncertain; use bounded retries with the same operation key.                           |

For example, start backoff at one second, double up to 60 seconds, add jitter, and stop after a
bounded number of attempts for operator review. Never retry every input row as fast as possible.
Valid authenticated malformed writes also consume the shared credential budget. Duplicate
idempotency/precondition headers, unsupported queries and bodies on GET/DELETE are invalid.
Responses use `Cache-Control: no-store`; clients should avoid retaining sensitive response bodies
outside the storage their workflow requires.

## Rotation, revocation and incidents

Owners/admins can inspect safe prefixes, effective status, scope/resource/IP policy, creator,
expiry, last-use time and version creation/revocation history from integration settings. Refresh
the list to observe recent use. An expired key cannot authenticate or rotate; revoke it and issue
a new integration if replacement is no longer possible. A separate integration does not inherit
the old integration's transaction ownership.

Before expiry, choose **Replace key**, review its permissions and restrictions, and confirm the
immediate effect. Rotation preserves integration identity and existing transaction ownership.
The previous key stops authenticating immediately, with no overlap; update the client secret in
the same maintenance window. You can narrow or replace policy during rotation. Remove unavailable
or archived selections before confirming. A lost rotation response requires refreshing the list
and replacing the newly active version, rather than retrying the old version indefinitely.

If a key may have leaked, revoke it immediately, stop affected jobs, inspect safe last-use and
audit evidence, and issue a new integration credential. A separately issued integration has a new
identity and cannot manage the old integration's records; those records remain available through
the human workspace transaction API. Review scopes,
resource/IP restrictions and the client's secret handling. Redact any exposed headers and remove
the leaked copy from logs or other storage. Revocation is irreversible and does not delete
transactions; a request authenticated before revocation may still finish. Reconcile financial
effects by stable external identity and audit, not by replaying every operation with fresh keys.

Only revoked versions can be hidden from the list. Hiding a version retains financial records,
ownership and lifecycle/audit evidence. It never reveals or restores the old secret.

## Transaction API reference

### Common rules

- POST accepts an optional `Idempotency-Key`; PUT and DELETE require it. Keys contain 16–128
  visible ASCII characters after trimming.
- POST and PUT bodies must use `Content-Type: application/json` and fit within 64 KiB. Malformed
  JSON returns `400`, an oversized body returns `413`, and another media type returns `415`.
- Repeated `Idempotency-Key` or `If-Match` headers are rejected. Unsupported query parameters are
  rejected; GET, HEAD, and DELETE do not accept a non-empty body. Authenticated malformed writes
  consume the same rate limit as other mutations.
- Responses, including authentication and error responses, use `Cache-Control: no-store`.
- Amounts are positive strings with exactly two decimal places, for example `"12.34"`.
- IDs are opaque Monqom IDs; names are never accepted in their place.
- A newly created transaction, get, or replacement returns `ETag: "tx-v<number>"`.
- Replacement and deletion require that exact value in `If-Match`. A missing value returns `428`,
  a malformed value returns `400`, and a stale value returns `412`.
- A credential can access only resources in its workspace and any configured category or payment
  source allowlist. Missing, manual, deleted, or foreign transactions all return `404`.

### Routes and scopes

| Method | Route                                                               | Required scope            | Success   |
| ------ | ------------------------------------------------------------------- | ------------------------- | --------- |
| POST   | `/api/v1/workspaces/:workspaceId/external-transactions`             | `transactions:create`     | 201 / 200 |
| GET    | `/api/v1/workspaces/:workspaceId/external-transactions/:externalId` | `transactions:read-own`   | 200       |
| PUT    | `/api/v1/workspaces/:workspaceId/external-transactions/:externalId` | `transactions:update-own` | 200       |
| DELETE | `/api/v1/workspaces/:workspaceId/external-transactions/:externalId` | `transactions:delete-own` | 204       |
| GET    | `/api/v1/workspaces/:workspaceId/external-categories`               | `categories:read`         | 200       |
| GET    | `/api/v1/workspaces/:workspaceId/external-payment-sources`          | `payment-sources:read`    | 200       |

Scopes are exact and independent. In particular, `transactions:create` does not grant get,
replace, delete, listing, export, or metadata access. There is no transaction collection route.

### Create and replace schema

`POST` accepts an optional `external_id`. Omitted or null values stay null; Monqom does not invent
an identifier. A supplied ID is trimmed, case-sensitive and limited to 1–200 UTF-8 bytes. Clients
importing multiple accounts namespace IDs themselves, for example `account-a:record-123`.
`PUT` addresses the external ID in the route and rejects a different body value.
Category is optional: omission creates an uncategorized transaction, permitted only by an
unrestricted category policy. Payment source is always required. The body accepts:

```json
{
  "external_id": "bank-entry-123",
  "type": "expense",
  "amount": "12.34",
  "currency": "PLN",
  "date": "2026-09-04",
  "description": "Coffee",
  "category_id": "cat_example",
  "payment_source_id": "source_example",
  "notes": "Optional",
  "tags": ["daily"]
}
```

### Response schema

Create, get, and replace return a JSON object with `id`, `external_id`, `version`, `category_id`,
`payment_source_id`, `type`, fixed-decimal `amount`, `currency`, `date`, `description`, `notes`,
`tags`, `created_at`, `updated_at`, and `replayed`. Metadata endpoints return only display metadata:
IDs, names, type, system key, and (for categories) hierarchy, icon, color, and sort order.

On transaction writes, `external_id`, `category_id`, and `notes` may be null; `tags` is an array
and `amount` is a fixed two-decimal string. The already-known external ID response is deliberately
smaller: `{ "status": "already_exists", "external_id": "…" }`. Category metadata includes a
nullable `parent_id`; archived, disallowed, or otherwise hidden parents are represented as null.
Metadata reads do not expose budgets, balances, or write operations.

## Credential management API reference

Workspace owners and administrators use these endpoints to manage unattended clients. The API
uses human browser sessions. Integration bearer credentials cannot manage themselves or inherit
human workspace permissions. The prefix is `/api/v1`; `W`, `I` and `C` below are workspace,
integration and credential-version IDs.

### Authentication and authorization

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

### Routes and outcomes

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

### Create request

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

### List and get responses

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

### Rotate request

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

### Revoke and safe-delete

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

See [the credential security decision](adr/0002-workspace-integration-credentials.md) for the security design.
