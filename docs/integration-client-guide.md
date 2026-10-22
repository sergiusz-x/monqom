# Connect an external transaction client

Use an integration credential to import transactions into one workspace. It authenticates a
machine client, independently of your browser session. The examples use neutral names such as
`expense-importer` and `external-expense-123`.

See the [transaction API reference](external-transactions-api.md) for all schemas, headers and
outcomes, and the [credential management reference](integration-management-api.md) for the separate
human session API. These credentials never grant transaction listing, export, dashboard access,
metadata writes, or access to manual or another integration's transactions.

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
