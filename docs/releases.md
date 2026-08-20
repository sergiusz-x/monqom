# Releases

## v1.0.0 — public beta baseline

`v1.0.0` establishes the first public Monqom beta. It is the baseline for all later releases, not a claim that the beta is feature-complete or free of operational risk.

Included in the baseline:

- personal workspaces, categories, transactions, budgets, payment sources, dashboards, and CSV/JSON export;
- account registration, email verification, password reset, server-side login sessions, two-factor authentication, rate limits, temporary lockouts, CSRF protection, and Turnstile support;
- production configuration validation, security headers, structured logging, health/readiness endpoints, and privacy-safe client error handling;
- self-hosted Docker and Dokploy deployment assets, including a migration service and single-domain API proxy.

The tagged commit is immutable. Build and deploy the exact `v*` tag, not an untagged `main` commit.

## Release contract

1. Work is merged to `main` through a pull request with all required checks green.
2. Semantic-release evaluates Conventional Commits only after the canonical CI succeeds on a push to `main`.
3. A published `v*` GitHub Release is the immutable deployment input. The release workflow verifies that the new tag resolves to the exact CI-tested `HEAD`.
4. Dokploy uses its GitHub integration with automatic deployment enabled only for the `Tag` trigger. Branch pushes do not deploy; a newly created release tag does. An existing release tag can be redeployed manually from Dokploy when recovery is required.
5. Before a production rollout, complete [the release checklist](release-checklist.md) against the exact tagged commit.

## Versioning

- `MAJOR`: incompatible public API or product changes.
- `MINOR`: backwards-compatible features.
- `PATCH`: backwards-compatible fixes, dependency/security updates, and operational corrections.

Release notes describe user-visible changes and any upgrade or operational action. Do not move or recreate a published tag; issue a later patch release instead.
