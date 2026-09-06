# External transaction API

This API is for a workspace-bound integration credential. It is not a browser-session API.
Send the credential only as `Authorization: Bearer <credential>` over HTTPS. Each route is bound
to the `workspaceId` embedded in that credential.

## Common rules

- Mutation requests require an `Idempotency-Key` with 16–128 visible ASCII characters.
- Amounts are positive strings with exactly two decimal places, for example `"12.34"`.
- IDs are opaque Monqom IDs; names are never accepted in their place.
- A successful create, get, or replacement returns `ETag: "tx-v<number>"`.
- Replacement and deletion require that exact value in `If-Match`. Missing or malformed values
  return `428`; a stale value returns `412`.
- A credential can access only resources in its workspace and any configured category or payment
  source allowlist. Missing, manual, deleted, or foreign transactions all return `404`.

## Routes and scopes

| Method | Route                                                               | Required scope            | Success |
| ------ | ------------------------------------------------------------------- | ------------------------- | ------- |
| POST   | `/api/v1/workspaces/:workspaceId/external-transactions`             | `transactions:create`     | 201     |
| GET    | `/api/v1/workspaces/:workspaceId/external-transactions/:externalId` | `transactions:read-own`   | 200     |
| PUT    | `/api/v1/workspaces/:workspaceId/external-transactions/:externalId` | `transactions:update-own` | 200     |
| DELETE | `/api/v1/workspaces/:workspaceId/external-transactions/:externalId` | `transactions:delete-own` | 204     |
| GET    | `/api/v1/workspaces/:workspaceId/external-categories`               | `categories:read`         | 200     |
| GET    | `/api/v1/workspaces/:workspaceId/external-payment-sources`          | `payment-sources:read`    | 200     |

Scopes are exact and independent. In particular, `transactions:create` does not grant get,
replace, delete, listing, export, or metadata access. There is no transaction collection route.

## Create and replace schema

`POST` requires `external_id`; `PUT` addresses the external ID in the route and rejects a different
body value. The body accepts:

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

An identical completed request with the same key returns the original successful representation.
Changing the operation, external ID, or normalized body while reusing a key returns `409`. A live
concurrent claim returns `409` with `Retry-After: 1`.

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

## Errors

`400` validates headers or body; `401` is an indistinguishable credential failure; `403` means a
valid credential lacks the exact scope; `404` does not disclose ownership; `409` is an idempotency
or external-identity conflict; `412` is a stale ETag; `428` means `If-Match` is required; and `429`
includes `Retry-After`.

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
integration identity, its scopes, and restrictions, so update the client with the newly displayed
secret in the same maintenance window. If a secret may be exposed, revoke it immediately, inspect
the integration's last-use information and audit events, then reconcile records by stable external
ID. Revocation is irreversible. A revoked credential may be safely removed from the management
list, but removing it never removes financial transactions.

## Reliable importer behaviour

Use a stable, provider-side `external_id` for each record. Do not generate it from a changing
description, amount, or local database row number. Generate a fresh opaque `Idempotency-Key` for
each logical mutation, persist it with the outgoing request, and retry a timeout with the exact
same key and body. Reusing a key for a different operation, external ID, or body returns `409`.

On `409` with `Retry-After: 1`, wait at least that duration and repeat the same request. For other
rate limits, honor `Retry-After` and use bounded exponential backoff with jitter. Do not retry a
validation failure. A duplicate create with the same canonical record is replayed safely; a changed
record with the same external ID returns `409` so it cannot silently overwrite history.

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
