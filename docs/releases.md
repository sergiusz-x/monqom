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
4. The release workflow builds the migration, backend, and frontend images once. It runs the production migration and a critical authenticated savings-goal journey through the frontend proxy, scans all three images, and only then publishes them to GHCR with digest references and provenance attestations.
5. Immutable production deployment is opt-in. When explicitly enabled, the protected `production` environment deploys the verified `name@sha256` references and checks public readiness plus the expected commit SHA. A sustained failure restores the previous digest-pinned application manifest when one exists; it never reverses a database migration.
6. The original tagged source build remains the manual bootstrap recovery path. Its automatic tag trigger must be disabled before immutable deployment is enabled, so two deployment mechanisms can never race.
7. Before a production rollout, complete [the release checklist](release-checklist.md) against the exact tagged commit.

## Versioning

- `MAJOR`: incompatible public API or product changes.
- `MINOR`: backwards-compatible features.
- `PATCH`: backwards-compatible fixes, dependency/security updates, and operational corrections.

Release notes describe user-visible changes and any upgrade or operational action. Do not move or recreate a published tag; issue a later patch release instead.
