# Monqom Contributor Guide

Monqom is a public finance application. Keep changes small, tested, and secure.

- Use Conventional Commit messages, for example: feat(auth): add email delivery.
- Never commit secrets, environment files, production URLs with credentials, user data, or operational tokens.
- Run relevant lint, typecheck, tests, and builds before opening a pull request.
- Maintain tenant isolation, integer-money arithmetic, CSRF protection, and secure session behavior.
- The public frontend talks to the backend only through /api.
- Reuse existing shared components and styles when building UI; support all existing languages and light and dark themes.
- When changing the API contract, regenerate the OpenAPI specification and client as described in CONTRIBUTING.md.
- Run database integration tests only against a separate, disposable test database.
- See CONTRIBUTING.md for development setup and checks.
