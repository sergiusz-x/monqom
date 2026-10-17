# ADR 0002: Workspace-bound integration credentials

- Status: Accepted
- Date: 2026-09-04
- Last revised: 2026-10-17

This record defines the required security contract. Accepted means the architecture was selected;
it does not certify that a deployed implementation meets it. Release readiness requires evidence
for the implementation requirements below. Numeric limits and lifetimes are Monqom policy choices.

## Context

Monqom currently authenticates people with server-side browser sessions. Workspace guards then
resolve membership, and role guards protect mutations. This is the correct model for the web
application, but it is not suitable for unattended importers, personal automation, or connector
services:

- sharing a browser cookie with a machine bypasses the intended browser and CSRF boundaries;
- a user-wide personal token would have a larger blast radius than one automation needs;
- write access must not silently grant the ability to list or export financial history;
- retries must not duplicate financial records;
- credential rotation must not change which externally managed transactions an integration owns;
- a guessed workspace, transaction, category, or payment-source identifier must never cross a
  tenant boundary.

The capability is a general product feature available to every user who has authority to manage
integrations in a workspace. It is not designed around one provider or automation tool: the Monqom
core does not know whether a client is a script, workflow engine, bank connector, or another
system.

## Decision

Monqom will use high-entropy opaque bearer credentials bound to one durable integration identity
and exactly one workspace. Machine authentication is separate from browser sessions and never
creates a user session or inherits membership permissions.

An integration starts with no scopes. Every operation requires one exact scope, and optional
resource and network restrictions can only narrow access.

### Minimal client profile

A create-only client needs just `transactions:create` and the POST endpoint. Its optional
`external_id` identifies a source record; Monqom's own transaction `id` remains server-generated.
The client chooses a stable external ID and handles provider-specific mapping. Monqom treats it as
an opaque string and does not infer identity from amount, merchant, date, or a hash of those fields.
Distinct purchases with identical financial fields remain distinct when they have distinct IDs.

A credential is bound to one workspace, not to exactly one payment source. Each create request
supplies `payment_source_id`; the same credential may target multiple active sources in that
workspace if its resource policy allows them. An optional source restriction is expressed as an
explicit allowlist; explicitly unrestricted access still stays within the bound workspace.

When one integration imports multiple source accounts, the client must namespace its external IDs
using a stable account reference, for example `account-a:record-123` and `account-b:record-123`.
Uniqueness remains workspace plus integration plus external ID; changing `payment_source_id`
does not turn a repeated ID into a new record. Source-specific identity mapping belongs to the
client and does not require bank-specific identifiers or rules in Monqom.

Read, update, and delete scopes are separate capabilities, not prerequisites for importing.
Persistent external-ID uniqueness is sufficient to prevent duplicate creates with that ID;
an additional `Idempotency-Key` is optional for POST. If neither identifier nor request key is
supplied, each accepted POST deliberately creates a new transaction. The API makes no duplicate
prevention guarantee for that mode.

Scheduled importers select eligible, settled source records and map their account references on
the client side. Provider-specific pending/booked status handling and scheduling do not introduce
another transaction lifecycle or conflict inbox in Monqom. A valid create with an already known
external ID is acknowledged without changing the stored transaction, even if submitted fields differ.
Source corrections and reconciliation require a separately authorized update capability later.

### Principal model

The persistence model separates:

1. **Integration identity** — durable ownership within one workspace. It has an ID, display name,
   workspace ID, creator, status, and lifecycle timestamps.
2. **Credential version** — a rotatable bearer secret for that identity. It has its own ID, safe
   token prefix, digest, expiry, scopes, restrictions, status, and usage metadata.

Transactions created by a machine belong to the durable integration identity, not to a credential
version. Rotating a credential therefore preserves access to records created by older versions of
the same integration. A credential can never change its workspace or integration identity.

The authenticated request principal contains only:

- integration ID;
- credential-version ID;
- workspace ID;
- exact scopes;
- category, payment-source, and CIDR restrictions.

It contains no user ID, workspace role, session, or implied permission.

### Credential format and storage

The token format is:

```text
mqic_<12-character-random-lookup-prefix>.<43-character-base64url-secret>
```

The secret is 32 cryptographically secure random bytes, providing 256 bits of entropy. The lookup
prefix is independently random, unique, non-secret, and is shown in management views so operators
can identify a credential without revealing it.

Generate the prefix from nine independent random bytes encoded as unpadded base64url. Enforce its
uniqueness in the database and regenerate on collision. Neither randomness nor uniqueness of the
prefix substitutes for verifying the full secret.

The complete token is returned exactly once after creation or rotation. Monqom stores only:

- the lookup prefix;
- `SHA-256("monqom-integration-credential:v1:" || complete-token)`;
- non-secret policy and lifecycle metadata.

The full token is never stored in the database, audit records, logs, traces, exception messages,
URLs, browser storage, long-lived frontend state, fixtures, or snapshots. Clearly labelled synthetic
test tokens may be generated for isolated tests; they must never authenticate against a real
deployment or be copied from issued credentials. Authentication performs
a constant-time byte comparison of the computed and stored digests. Unknown prefixes execute a
dummy digest comparison before returning the same generic authentication failure.

The high-entropy secret makes offline recovery infeasible if the database and digest are stolen.
Token prefixes are not authentication factors.

### Transport and presentation

Clients send credentials only as:

```http
Authorization: Bearer <token>
```

Query-string, request-body, cookie, and custom-header credentials are rejected. Production machine
authentication is accepted only over HTTPS. Reverse-proxy headers are trusted only through the
configured trusted-proxy chain. Local development may use loopback HTTP.

The backend checks the effective scheme before token lookup and rejects insecure production
requests without redirecting them. TLS termination at the configured reverse proxy follows
[ADR 0001](0001-single-domain-api-proxy.md); the backend must not be publicly reachable around that
proxy. An untrusted forwarded header cannot establish HTTPS or override the source IP. Reject
missing or ambiguous client-IP information when a CIDR policy needs it. Proxy, application,
exception, and tracing logs must exclude query strings and redact authentication material even
for requests rejected before authentication.

Responses that reveal a new token use `Cache-Control: no-store` and `Pragma: no-cache`. The
management UI holds the token only in component memory and clears it on dismissal, navigation,
error recovery, logout, or unmount.

### Lifetime, rotation, and revocation

- Expiry is required.
- The user chooses the lifetime in the management UI, which defaults to 90 days.
- The maximum lifetime is 365 days from issuance.
- Compare UTC instants: issuance must precede expiry, expiry must be at most 365 times 24 hours
  after issuance, and a credential is expired when server time is greater than or equal to expiry.
  A date-picker value that exceeds this bound is rejected before persistence.
- Expired credentials never authenticate and cannot be reactivated.
- Rotation atomically creates a new version and immediately revokes the old version. There is no
  overlap window.
- Revocation is immediate, idempotent, irreversible, and checked from authoritative persistence on
  the next request. Positive authentication results are not cached across requests.
- Safe deletion is allowed only after revocation. It removes the credential from normal listings
  while retaining non-secret lifecycle and audit evidence according to the application retention
  policy.

Serialize rotation, revocation, and creator-membership revocation against the same authoritative
credential state. Two simultaneous rotations of one version may produce only one replacement;
the losing rotation returns `409` without creating an orphan or another active version. Rotation
must not reactivate a version revoked by a concurrent operation. Every authentication starting
after a revocation commits must fail; a request authenticated before that commit may finish.

If a credential may have leaked, an owner or administrator revokes or rotates it, reviews its
last-used metadata and audit events, and reconciles transactions owned by the integration. Rotating
the credential does not require changing the integration identity or external transaction IDs.

### Workspace membership lifecycle

Integration credentials are workspace assets but are created through a human administrator's
authority. To prevent a removed administrator from retaining machine access:

- removing the creator from the workspace;
- deleting the creator's user account; or
- demoting the creator below `admin`

atomically revokes every active credential version of integrations they created. Workspace deletion
removes all integration identities, credentials, idempotency records, and integration-owned
transactions through the existing workspace lifecycle. Revocation does not delete financial records.

Another owner or administrator can create a replacement integration. Transferring credential
creator ownership is not supported in the initial design.

Rotation by another administrator does not change the integration's creator or bypass this rule.
Account deletion must preserve non-secret ownership and audit attribution without leaving a live
credential or a foreign-key dependency that prevents deletion. Authoritative authentication must
also reject credentials whose creator no longer has the required membership.

### Management authorization and step-up

Only workspace owners and administrators can list, create, inspect, rotate, revoke, or safely
delete integration credentials. This remains true even though integrations are generally available
to every Monqom user: a user can manage them in a workspace where they hold one of these roles, but
an ordinary member cannot open external access to a shared workspace. Ordinary members and
outsiders receive the existing non-disclosing workspace behavior.

Creation, rotation, and revocation require recent human authentication no older than five minutes:

- the current password must be verified; and
- if two-factor authentication is enabled, a current TOTP or unused recovery code must also be
  verified.

Listing safe metadata does not require step-up. Secret material is never returned by list or get
operations.

Validate the complete management request before persisting anything: scopes, expiry, CIDRs, and
workspace resource policies. Invalid policy returns `400`. Integration creation, its first
credential, and the lifecycle audit event commit atomically. Rotation and revocation likewise
commit their state change and audit event together. The audit actor is the administrator actually
performing the action, which may differ from the integration's creator.

### Exact scopes

The authorization model reserves these exact, independently grantable capabilities so adding a
future operation does not require broadening an existing scope:

| Scope                     | Grants                                                                |
| ------------------------- | --------------------------------------------------------------------- |
| `transactions:create`     | Create an external transaction owned by this integration              |
| `transactions:read-own`   | Get one transaction owned by this integration by external ID          |
| `transactions:update-own` | Replace one transaction owned by this integration by external ID      |
| `transactions:delete-own` | Soft-delete one transaction owned by this integration by external ID  |
| `categories:read`         | List minimal active category metadata allowed by the credential       |
| `payment-sources:read`    | List minimal active payment-source metadata allowed by the credential |

The lifecycle release can issue each of the six exact scopes. They remain independently granted:
`transactions:create` never implies transaction lookup, update, or deletion, and metadata scopes
never imply a transaction operation. Empty scopes authenticate but authorize no endpoint.

Scope comparison is exact and case-sensitive. There are no wildcards, implied scopes, role-derived
scopes, `all`, `admin`, or full-access option. An empty scope set authenticates but authorizes no
operation.

Write scopes never grant collection reads, transaction search, dashboard access, exports, budgets,
goals, memberships, profiles, audit logs, user data, or credential management. `read-own` grants
only exact lookup by an external ID owned by the same durable integration; it does not grant a
transaction collection endpoint.

### Endpoint-to-scope matrix

The public route names are provider-neutral. Each route is independently guarded; no scope implies
another capability or exposes a collection of financial records:

| Method and route                                                           | Required scope            | Additional rule                              |
| -------------------------------------------------------------------------- | ------------------------- | -------------------------------------------- |
| `POST /api/v1/workspaces/:workspaceId/external-transactions`               | `transactions:create`     | Optional `external_id` and `Idempotency-Key` |
| `GET /api/v1/workspaces/:workspaceId/external-transactions/:externalId`    | `transactions:read-own`   | Exact integration ownership                  |
| `PUT /api/v1/workspaces/:workspaceId/external-transactions/:externalId`    | `transactions:update-own` | `Idempotency-Key` and `If-Match` required    |
| `DELETE /api/v1/workspaces/:workspaceId/external-transactions/:externalId` | `transactions:delete-own` | `Idempotency-Key` and `If-Match` required    |
| `GET /api/v1/workspaces/:workspaceId/external-categories`                  | `categories:read`         | Active allowed metadata only                 |
| `GET /api/v1/workspaces/:workspaceId/external-payment-sources`             | `payment-sources:read`    | Active allowed metadata only                 |

Machine principals are routed through dedicated authentication and scope guards, never through
`SessionGuard`. Browser-session endpoints continue to reject bearer-only machine authentication.

### Resource restrictions

A credential has independently configurable allowlists of category IDs and payment-source IDs.
Restrictions are validated as active resources in the bound workspace when the credential is
created or rotated. The management UI makes these restrictions explicit and encourages the
narrowest set required by the integration.

- Credential creation and rotation require an explicit category policy and payment-source policy;
  the administrator must select resources or choose the explicit unrestricted option. Missing
  policy is rejected before persistence, rather than interpreted as unrestricted.
- An explicit empty allowlist allows no resource of that type.
- A populated allowlist allows only those IDs.
- An allowlist never grants its related scope.
- Archived, foreign-workspace, missing, or later-invalidated resources are denied at use time.

These rules apply to create, get, update, delete, and response replay. Get and delete check the
stored transaction's resources; update checks both the stored and proposed resources. A restricted
credential cannot edit an excluded transaction into its allowed set. An inaccessible stored
target returns the same `404` as a missing one; a disallowed proposed reference returns `400`
without identifying whether it exists elsewhere. A replay uses the retained target metadata,
including a deletion tombstone, to enforce the current policy before disclosing a stored result.
Check both the current target's references and those retained with the result, so a historical
response cannot disclose resources excluded by a replacement credential's policy.

An uncategorized transaction is permitted only by an explicitly unrestricted category policy;
an empty or finite category allowlist does not include a null category. The payment source always
remains required. This preserves the distinction between an optional category in the transaction
body and an explicit decision about which resources a credential may access.

Metadata endpoints return only ID, type, display name, system key where applicable, hierarchy,
icon/color/order where applicable, and archived status when necessary to explain a denial. They do
not return transaction counts, totals, budgets, or other financial data.

An optional CIDR allowlist is evaluated against the trusted client IP. Omitted means no additional
IP restriction; an explicit empty list allows no address. Only canonical IPv4 and IPv6 CIDRs are
accepted. A CIDR match never grants a scope or workspace permission.

Reject invalid addresses and prefix lengths before persistence. Normalize equivalent addresses,
including IPv4-mapped IPv6, before matching so representation differences cannot bypass a policy.

### External transaction ownership

An external transaction stores integration ownership and an optional caller-provided `external_id`.
When the field is omitted or null, store null without fabricating a source identifier. Multiple
transactions without an external ID are allowed, including identical purchases. Their integration
ownership is still recorded, but they are not addressable through the external-ID routes.
Manual transactions keep null integration ownership and remain inaccessible to machine routes.

When supplied as a string, the normalized external ID is trimmed, case-sensitive UTF-8, between
1 and 200 bytes, and unique for `(workspace ID, integration ID, external ID)`. It is retained
after soft deletion so the same provider record cannot be recreated accidentally. Keep the
uniqueness constraint inclusive of deleted rows; deletion must not clear the ID or replace this
constraint with an active-record-only index. Reject empty or invalid supplied strings with
`400`; they are not another way of omitting the field. Enforce uniqueness in the database so
simultaneous creates with the same non-null ID cannot both succeed.

Every ownership check includes workspace ID, integration ID, external ID, and active/deleted state
in the database predicate. A caller-supplied provider name is never part of the ownership boundary.
Knowing an internal transaction UUID or another integration's external ID grants nothing.

The payment source is required and must be an existing, active, allowed resource. Category is
optional. When omitted, Monqom creates an uncategorized transaction that is visibly surfaced in the
web application for later manual assignment. When supplied, it must be an existing, active,
allowed category. Machine clients cannot create, rename, archive, or otherwise mutate categories
or payment sources.

For a new transaction, category and payment-source validation, amount conversion, tags, the mutation, any
requested idempotency result, and audit event commit in one database transaction.

### Idempotency and replay

POST accepts an optional `Idempotency-Key`; PUT and DELETE require it. Request keys identify an
operation attempt, while `external_id` identifies a source transaction across repeated imports.
These are independent mechanisms. A create without a request key does not need a replay record
or claim lease. Its supplied external ID, if any, still has permanent uniqueness protection.

When a request key is supplied, the following rules apply:

- the value is 16 to 128 visible ASCII characters after trimming;
- it is transported only in the header and is never logged verbatim;
- Monqom stores a context-labelled SHA-256 digest of the key;
- uniqueness is enforced for `(integration ID, key digest)` across all operations;
- the stored record includes operation, target external ID when present, canonical request
  fingerprint, state, response status, replayable response body, and the original ETag where applicable;
- canonical fingerprints are calculated after validation, normalization, defaults, and decimal-to-
  integer conversion.

Fingerprint only stable caller intent: operation, target external ID, normalized body, and the
submitted `If-Match` value where required. Use deterministic field ordering and canonical tag-set
ordering. Do not include derived exchange rates, converted base amounts, current workspace base
currency, lookup labels, timestamps, or any other mutable server state. This fingerprint belongs
to the request-key replay record. Duplicate handling based on external ID alone does not require
a permanent original-payload fingerprint or receipt.

The first request atomically claims the key. An identical completed retry returns the stored status
and response without another mutation or audit event. Reuse with a different operation, target, or
canonical body returns `409 Conflict` and performs no mutation. A concurrent request that sees a
live in-progress claim returns `409 Conflict` with `Retry-After: 1`; the client retries with the
same key.

Authenticate and enforce the current workspace, scope, network, and resource policies before
replaying a result. An old successful request does not authorize a revoked credential or a
replacement with narrower permissions. Perform the replay lookup before fetching exchange rates
or applying current-version preconditions. A lost response must remain recoverable after an FX
provider outage or an intervening authorized edit. Replaying a mutation needs that mutation's
scope, never an implied read scope, and returns its original result rather than current fields.

Only successful committed operation results are replayable. Validation failures and rolled-back
operations leave no completed result; a retry can attempt the operation again. The financial
mutation (if any), completed result, and any required audit event either all commit or all roll back.

Completed idempotency records are retained for seven days. In-progress claims have a five-minute
lease and can be recovered after a crash. Cleanup never removes a live claim. Permanent external-ID
uniqueness remains the second line of defence after an idempotency record expires.

Measure the seven days from successful completion. Expired results cannot be replayed while
awaiting cleanup. Run cleanup at least daily. Recovery of an expired in-progress claim must use
an exclusive lock or fencing generation so an older worker cannot commit after losing ownership;
lease expiry alone must never authorize a second concurrent financial mutation.

Creating an already known external ID never updates or creates another transaction. After request
validation and current authorization, check ownership by workspace, integration, and external ID
before fetching exchange rates or inserting. A newly created record returns `201 Created`.
An existing ID returns `200 OK` with only this acknowledgement:

```json
{ "status": "already_exists", "external_id": "account-a:record-123" }
```

This response echoes the supplied ID and discloses no current financial fields, version, or deletion
state. It applies even if the valid submitted fields differ or a user edited or soft-deleted the
stored transaction. Do not compare payloads, overwrite data, create a second transaction, restore
the deleted record, or create a conflict inbox entry. A database uniqueness conflict from a
concurrent insert follows the same acknowledgement path after the relevant authorization checks.
This policy deliberately does not detect a source that incorrectly reuses an ID, nor synchronize
later source corrections; those belong to a future update/reconciliation capability.

If a request key is supplied, its independent replay and fingerprint rules still apply first.
Reusing that request key with different input returns `409`; an identical retained retry replays
the original response. External-ID uniqueness continues after the replay record expires.

### Optimistic concurrency

External transactions have a monotonically increasing integer version. Responses for a newly
created record and get responses include a strong ETag such as:

```http
ETag: "tx-v3"
```

Update and delete require `If-Match` with the last observed strong ETag. A missing precondition
returns `428 Precondition Required`; a stale value returns `412 Precondition Failed`. The version
check and mutation occur in one database predicate. An identical idempotent retry replays its
original successful result even if the current resource version has advanced.

Every change to an externally owned transaction, including browser edits, tag changes, and soft
deletion, increments its version in the same transaction. Machine callers must submit one observed
strong ETag; weak tags, lists, and `If-Match: *` are rejected with `400` by this API's narrower
precondition contract. No version or financial value is disclosed before ownership and current
resource policies have been checked.

### Validation and error disclosure

Machine DTOs reject unknown properties. Amounts are positive fixed two-decimal strings and are
converted with existing integer-money utilities. Currency, date, description, notes, tags,
category, payment source, and transaction type follow the canonical transaction invariants. The
request body limit is 64 KiB.

Error behavior is deliberately narrow:

| Status | Meaning                                                                                               |
| ------ | ----------------------------------------------------------------------------------------------------- |
| `400`  | Invalid headers, DTO, resource restriction, or transaction input                                      |
| `401`  | Missing, malformed, unknown, expired, revoked, or network-disallowed credential                       |
| `403`  | Valid credential lacks the exact required scope                                                       |
| `404`  | Target is missing, manual, deleted when active is required, foreign integration, or foreign workspace |
| `409`  | Request-key fingerprint conflict, active claim, or conflicting credential lifecycle operation         |
| `412`  | `If-Match` does not match the current owned resource version                                          |
| `428`  | Required `If-Match` is absent                                                                         |
| `429`  | Per-credential or unauthenticated-source rate limit exceeded                                          |
| `503`  | Authoritative authentication or shared rate-limit storage is unavailable; no mutation is allowed      |

Responses do not distinguish unknown from expired or revoked credentials, nor missing from foreign
resources. Internal logs may record a bounded reason code but never tokens, raw idempotency keys,
financial payloads, or unrestricted identifiers.

Unauthenticated responses include a generic `WWW-Authenticate: Bearer` challenge. Once valid
authentication is established, check workspace binding and exact scope before resolving a target;
check ownership and resource restrictions before disclosing conflicts or version information.

### Rate limits

Rate limits are authoritative and shared across application replicas:

- 120 authenticated machine requests per credential per rolling minute;
- within that total, 60 mutations per credential per rolling minute;
- 20 failed machine-authentication attempts per trusted source IP per five minutes, followed by a
  15-minute block;
- all `429` responses include `Retry-After`.

Limits are isolated by credential and workspace and cannot be reset by rotating request headers or
changing an external ID. Deployments can lower these values, but cannot raise them above the
documented ceilings without a new reviewed decision. Bulk collection endpoints are not introduced
to bypass these limits.

Use rolling windows rather than independent fixed buckets. Authenticated retries, denied-scope
requests, and invalid mutation attempts count toward their relevant limits; replay never bypasses
them. GET consumes the total limit, while POST, PUT, and DELETE consume both total and mutation
limits. Limit decisions are atomic across replicas. Unavailable authoritative state fails closed
with `503` rather than falling back to a per-process counter.

### Audit and operational metadata

Credential lifecycle audit events contain:

- action;
- workspace ID;
- human actor ID;
- integration ID and credential-version ID;
- safe prefix;
- previous and new status;
- expiry;
- exact scope and restriction changes;
- timestamp and bounded reason code.

Record creation, rotation, revocation, safe deletion, and membership-driven revocation. Also record
denied management and step-up attempts with the actual human actor when known, without credentials
or submitted passwords. Required lifecycle audit persistence is part of the mutation's transaction.

Machine transaction audit events identify the integration and credential version as the actor and
use the existing transaction audit semantics. They never place the full token, digest, raw
idempotency key, CIDR source address, or provider secret in metadata.

`lastUsedAt` and the trusted source IP are operational metadata. To avoid a database write on every
request, successful usage is updated at most once per credential every five minutes. The stored IP
is canonical and access-controlled; normal management views show only last-use time. Failed uses of
revoked credentials are security events with bounded, non-secret metadata.

Last-use metadata updates are best effort: their failure must not turn a valid authentication into
an error or weaken the mandatory authentication, rate-limit, and audit checks.

### Threat model

| Threat                                     | Required mitigation                                                                                                       |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Token theft                                | TLS, one-time reveal, no browser persistence, exact scopes, expiry, rotation, immediate revocation, optional CIDRs        |
| Database theft                             | Store only a digest of a 256-bit token; no recoverable plaintext; separate safe prefix                                    |
| Log or trace leakage                       | Authorization and idempotency headers are always redacted; payloads and query strings are excluded from machine-auth logs |
| Replay after lost response                 | Optional request-key replay or permanent external-ID uniqueness; creates without either may be repeated                   |
| Concurrent duplicate requests              | Atomic idempotency claim and database uniqueness constraints                                                              |
| Brute force                                | 256-bit secret, random lookup prefix, dummy digest comparison, source-IP failure limits                                   |
| Cross-workspace access                     | Immutable workspace binding plus workspace predicates on every lookup and mutation                                        |
| Guessed identifiers                        | Exact durable integration ownership and non-disclosing `404` behavior                                                     |
| Privilege escalation                       | Empty-by-default exact scopes; no wildcard, implication, session, or role inheritance                                     |
| Financial-data export through write access | No list/search/export route; write scopes do not grant metadata or read scopes                                            |
| Stale administrator access                 | Automatic revocation after creator removal, deletion, or demotion below admin                                             |
| Compromised automation host                | Narrow scopes and resources, CIDR option, rate limits, rotation, revocation, attributable audit trail                     |
| Request tampering or lost update           | Canonical idempotency fingerprint and strong `If-Match` preconditions                                                     |

### Residual risks and operator responsibilities

A compromised automation host can perform every operation already granted to its credential.
CIDRs cannot protect against an attacker using that same host. Operators must keep the token in
their secret store, minimize scopes and resource policies, and revoke it when compromise is
suspected. Idempotency prevents accidental duplicate effects; it is not protection against a thief
submitting new authorized requests with fresh keys.

Digest storage protects token recovery after a read-only database theft; it does not encrypt
financial records or protect against an attacker who can modify authoritative database state.
An explicitly unrestricted resource policy deliberately gives wider access within the integration's
workspace and ownership boundary. Granting `transactions:read-own` explicitly accepts disclosure
of those owned records, including later human edits. Audit evidence and limits help detect and
bound misuse; they do not make a compromised server or client trustworthy.

## Consequences

### Positive

- An importer can be limited to one workspace and only the operations it needs.
- Every eligible user can configure a provider-neutral integration from workspace settings.
- Credential theft has a bounded lifetime and blast radius.
- Transaction imports are safe to retry after timeouts, crashes, and credential rotation.
- Public Monqom remains independent of any bank, workflow engine, or data provider.
- Write-only integrations cannot become a general financial-history export path.

### Costs

- The product needs new integration, credential-version, idempotency, and transaction-ownership
  persistence and a workspace-settings management UI.
- Owners must rotate credentials and update clients explicitly.
- Immediate rotation interrupts clients until they install the replacement. A lost issuance
  response requires another rotation because the server cannot reveal the secret again.
- Initial imports are bounded by mutation rate limits and require client backoff.
- Recent-authentication step-up needs a reusable server-side mechanism.

## Alternatives considered

### Reuse browser sessions

Rejected. Session cookies, CSRF protection, browser lifecycle, and human membership authorization
are the wrong trust model for unattended machines. Sharing cookies also makes revocation and audit
attribution ambiguous.

### User-wide personal access tokens

Rejected. A user can belong to multiple workspaces, so a user-wide token has unnecessary reach and
couples automation access to changing human membership privileges.

### OAuth authorization server

Deferred. OAuth is appropriate for a third-party integration ecosystem and delegated user consent,
but it adds clients, redirects, grants, refresh tokens, consent, and revocation infrastructure that
owner-operated integrations do not yet need. The durable integration identity can remain the
resource-owner boundary if OAuth is added later.

### One shared webhook secret

Rejected. A shared secret cannot express workspace, scope, resource, expiry, rotation, ownership,
or per-client audit boundaries safely.

### Provider-specific bank routes

Rejected. Provider credentials and consent flows belong in connectors. Monqom exposes a neutral
external transaction contract so providers can change without changing the financial core.

### Broad transaction read scope

Rejected. Collection reads and exports create a materially larger confidentiality risk. A future
read/export capability requires a separate threat model and explicit decision.

## Implementation requirements

Subsequent implementation must preserve existing session guards, workspace guards, role checks,
explicit workspace predicates, audit behavior, integer-money arithmetic, soft deletion, and CSRF
behavior. Machine authentication is an additional narrow path, not a replacement.

Tests must cover every scope independently, empty scopes, expiry boundaries, rotation, revocation,
CIDRs, rate limits, creator membership changes, log redaction, guessed IDs, two workspaces, manual
transactions, another integration's transactions, idempotent retries, conflicting retries,
concurrency, stale ETags, and crash recovery.

Release evidence must additionally demonstrate that:

- distinct external IDs preserve identical purchases as separate transactions, while retrying
  one ID, even with changed valid data, returns `already_exists` and preserves later human edits;
- retrying a soft-deleted external ID returns the same acknowledgement without restoring it;
- omitting both external ID and request key creates a new transaction on each accepted request,
  and concurrent creates with the same supplied ID cannot both insert;
- a narrower rotated credential cannot get, delete, or replay an excluded transaction;
- browser edits invalidate earlier ETags and duplicate create acknowledgements disclose no later
  financial state;
- membership removal or deletion and concurrent rotation leave no usable orphan credential;
- a retry with unchanged input survives changed FX data without another mutation;
- expired claim recovery cannot let the original worker commit afterward;
- invalid management policy leaves no partial integration, credential, or success audit event;
- insecure requests and secret-bearing query strings cannot leak credentials through any logging
  layer;
- shared limits and committed revocation apply across replicas, and cleanup actually runs.

## References

- [RFC 6750: Bearer Token Usage](https://www.rfc-editor.org/rfc/rfc6750)
- [RFC 9110: HTTP Semantics and If-Match](https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.1)
- [RFC 6585: Additional HTTP Status Codes](https://www.rfc-editor.org/rfc/rfc6585)
- [OWASP Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [OWASP API Security Top 10](https://owasp.org/API-Security/)
- [OWASP API1: Broken Object Level Authorization](https://api-security.owasp.org/editions/2023/en/0xa1-broken-object-level-authorization/)
