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
