# External transaction API

Start with [the integration client guide](integration-client-guide.md) for safe setup, scope
selection, stateless imports, lifecycle retries and credential incidents.

For human owner/admin operations that issue, rotate, revoke or safely delete credentials, see
[the integration management API](integration-management-api.md).

This API is for a workspace-bound integration credential. It is not a browser-session API.
Send the credential only as `Authorization: Bearer <credential>` over HTTPS. Each route is bound
to the `workspaceId` embedded in that credential.

## Common rules

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

## Routes and scopes

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

## Create and replace schema

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

Example create request:

```http
POST /api/v1/workspaces/ws_example/external-transactions HTTP/1.1
Authorization: Bearer mqic_…
Idempotency-Key: 9b4f9b3b47f54e13
Content-Type: application/json
```

An identical completed request with the same key returns the original successful representation,
status and ETag, even after a human edit or an FX provider outage. Current credential restrictions
are checked against both the current transaction and the retained result before replay.
Changing the operation, external ID, or normalized body while reusing a key returns `409`. A live
concurrent claim returns `409` with `Retry-After: 1`.

Creating an already known external ID returns `200` with only
`{"status":"already_exists","external_id":"account-a:record-123"}`. This includes valid changed
input and previously edited or soft-deleted transactions. It does not disclose their current
fields, version, or deletion state and never overwrites or restores them. A request key, when
supplied, is checked first: conflicting reuse still returns `409`.

Without an external ID or request key, each accepted create produces a new transaction.

Example replacement additionally includes:

```http
PUT /api/v1/workspaces/ws_example/external-transactions/bank-entry-123 HTTP/1.1
Authorization: Bearer mqic_…
Idempotency-Key: 4e1479b0d3f74b39
If-Match: "tx-v1"
Content-Type: application/json
```

## Response schema

Create, get, and replace return a JSON object with `id`, `external_id`, `version`, `category_id`,
`payment_source_id`, `type`, fixed-decimal `amount`, `currency`, `date`, `description`, `notes`,
`tags`, `created_at`, `updated_at`, and `replayed`. Metadata endpoints return only display metadata:
IDs, names, type, system key, and (for categories) hierarchy, icon, color, and sort order.

On transaction writes, `external_id`, `category_id`, and `notes` may be null; `tags` is an array
and `amount` is a fixed two-decimal string. The already-known external ID response is deliberately
smaller: `{ "status": "already_exists", "external_id": "…" }`. Category metadata includes a
nullable `parent_id`; archived, disallowed, or otherwise hidden parents are represented as null.
Metadata reads do not expose budgets, balances, or write operations.

## Request examples

Each example below requires only the scope shown in the route table. Replace the workspace and
resource IDs with IDs returned by Monqom. Use the exact strong ETag returned by a previous response
for replacement and deletion.

Create an expense (`transactions:create`); `Idempotency-Key` and `external_id` are optional:

```http
POST /api/v1/workspaces/ws_example/external-transactions HTTP/1.1
Authorization: Bearer mqic_…
Content-Type: application/json

{"type":"expense","amount":"12.34","currency":"PLN","date":"2026-09-04","description":"Coffee","payment_source_id":"source_example"}
```

Look up exactly one transaction owned by this integration (`transactions:read-own`):

```http
GET /api/v1/workspaces/ws_example/external-transactions/bank-entry-123 HTTP/1.1
Authorization: Bearer mqic_…
```

Replace that transaction (`transactions:update-own`). Include the complete create/replace body and
the latest ETag:

```http
PUT /api/v1/workspaces/ws_example/external-transactions/bank-entry-123 HTTP/1.1
Authorization: Bearer mqic_…
Idempotency-Key: replace-entry-123-0001
If-Match: "tx-v1"
Content-Type: application/json

{"type":"expense","amount":"12.34","currency":"PLN","date":"2026-09-04","description":"Coffee","payment_source_id":"source_example"}
```

Soft-delete the exact owned transaction (`transactions:delete-own`):

```http
DELETE /api/v1/workspaces/ws_example/external-transactions/bank-entry-123 HTTP/1.1
Authorization: Bearer mqic_…
Idempotency-Key: delete-entry-123-0001
If-Match: "tx-v2"
```

Read allowed active categories (`categories:read`):

```http
GET /api/v1/workspaces/ws_example/external-categories HTTP/1.1
Authorization: Bearer mqic_…
```

Read allowed active payment sources (`payment-sources:read`):

```http
GET /api/v1/workspaces/ws_example/external-payment-sources HTTP/1.1
Authorization: Bearer mqic_…
```

The category and payment-source responses contain only the minimal metadata described above.
They are separately scoped; neither scope grants transaction access. All successful transaction
responses include an ETag except the already-known ID response and the bodyless `204` delete.

## Errors

`400` validates headers, JSON, body fields or proposed resource references; `401` is an
indistinguishable credential failure; `403` means a valid credential lacks the exact scope; `404`
does not disclose ownership; `409` is an idempotency conflict or active claim; `412` is a stale
ETag; `413` means the JSON body exceeds 64 KiB; `415` means the write body is not JSON; `428` means
`If-Match` is required; and `429` includes `Retry-After`. A temporary rate-limit storage failure
fails closed with `503`.

## Credential lifecycle

Create a workspace-bound credential in **Settings → Integrations** as a workspace owner or
administrator. The complete bearer value is displayed only once after issuance or rotation. Store
it in a secret manager or the protected secret store of the runtime that executes the importer.
Never place it in source code, URLs, browser storage, logs, tickets, or chat messages.

Send it only in an `Authorization: Bearer` header over HTTPS. A production client must validate the
server certificate. Do not use query parameters, request bodies, cookies, or custom headers for a
credential.

Every scope is independent:

| Need                                   | Scopes                                                                      |
| -------------------------------------- | --------------------------------------------------------------------------- |
| Create-only importer                   | `transactions:create`                                                       |
| Reconcile one known external record    | `transactions:read-own`                                                     |
| Full external-record lifecycle         | `transactions:create`, `transactions:update-own`, `transactions:delete-own` |
| Discover permitted category/source IDs | `categories:read`, `payment-sources:read`                                   |

`transactions:create` does not grant any read, replace, delete, list, export, dashboard, or
metadata access. A lifecycle client can retain ETags returned by its successful writes; add
`transactions:read-own` only when it needs to recover an ETag by looking up an exact external ID.
Metadata scopes are optional and do not grant transaction access.

When issuing a credential, explicitly choose either a restricted list or unrestricted access for
categories and payment sources. A restricted empty list permits no resource of that type. The
payment source remains required when creating a transaction; category is optional and omission
creates an uncategorized transaction for later manual assignment. An optional CIDR allowlist is an
additional restriction, not a permission; an empty enabled CIDR list permits no client address.

Rotate before a scheduled expiry. Rotation immediately revokes the old value and preserves the
integration identity. Scopes and restrictions are preserved unless explicitly replaced; review
the selected policy and update the client with the newly displayed secret in the same maintenance
window. If a secret may be exposed, revoke it immediately, inspect
the integration's last-use information and audit events, then reconcile records by stable external
ID. Revocation is irreversible. A revoked credential may be safely removed from the management
list, but removing it never removes financial transactions.

## Reliable importer behaviour

Use a stable, provider-side `external_id` for each record. Do not generate it from a changing
description, amount, or local database row number. A stateless importer can repeatedly send settled
records with stable IDs and handle `already_exists`. For replay of an exact operation result,
generate an opaque `Idempotency-Key` and retry a timeout with the same key and body. Reusing a
retained key for a different operation, external ID, or body returns `409`.

On `409` with `Retry-After: 1`, wait at least that duration and repeat the same request. For other
rate limits, honor `Retry-After` and use bounded exponential backoff with jitter. Do not retry a
validation failure. A duplicate source ID returns `already_exists` even when valid fields differ;
source corrections require the separately authorized replacement operation.

For replace and delete, retain the latest strong ETag. A missing ETag gives `428`; a stale ETag
gives `412`. Fetch the exact integration-owned record only if the credential has `read-own`, decide
whether the external source is still authoritative, then retry with its new ETag and a new
idempotency key. A delete retry must reuse its original idempotency key; a completed retry returns
the prior success without deleting twice.

Minimal create-only example:

```sh
curl -X POST 'https://monqom.example/api/v1/workspaces/WORKSPACE_ID/external-transactions' \
  -H 'Authorization: Bearer YOUR_CREDENTIAL' \
  -H 'Idempotency-Key: a-unique-persisted-key' \
  -H 'Content-Type: application/json' \
  -d '{"external_id":"provider-entry-123","type":"expense","amount":"12.34","currency":"PLN","date":"2026-09-06","description":"Imported transaction","payment_source_id":"SOURCE_ID"}'
```

## Persistence and recovery

Transaction ownership uses the durable integration identity, so rotation preserves access.
Database uniqueness reserves `(workspace, integration, external_id)` permanently, including soft
deletion; null IDs permit distinct records. Composite foreign keys prevent cross-workspace ownership.

For keyed operations, a transaction-scoped PostgreSQL advisory lock serializes attempts across
replicas. Finance, tags, audit and the completed response commit or roll back together. The same
exclusive lock protects recovery of a five-minute expired claim, so a prior worker cannot commit
after another worker takes ownership. Uncommitted claims disappear on rollback or connection loss.
Completed results expire seven days after completion, are never replayed after expiry, and are
cleaned at startup and hourly. Cleanup preserves in-progress claims; expired claims are recovered
only by the locked command path. External-ID uniqueness remains after replay cleanup.

Canonical fingerprints contain normalized caller intent and the expected version, excluding
derived exchange rates and base amounts. Replay and duplicate detection precede FX resolution.
Reference validation holds shared row locks until commit. Reads, replacements, deletion, and
replay enforce current resource restrictions; replacement checks both old and new references.
Browser edits and deletion advance the same database-backed version used by machine preconditions.
