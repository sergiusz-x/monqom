# Release Checklist

1. CI is green for the exact release commit.
2. The release commit has an exact v* tag; each verified GHCR image resolves to an immutable digest and has a provenance attestation.
3. The production-image critical journey passed for the exact release images.
4. Dokploy migration completes; the migration is forward-compatible with the previous application release and does not require automatic database rollback.
5. Health, readiness, and version endpoints are healthy through the public domain and expose the expected release SHA.
6. Turnstile registration and Resend verification email are smoke tested when either integration changed.
7. Login, logout, password reset, CSRF rejection, rate limit, and lockout are smoke tested when authentication changed.
8. A backup completes and a restore drill is recorded.
9. Privacy notice and beta terms have owner approval.
10. The previous digest-pinned application manifest is available as the rollback target. For the first immutable deployment, the prior tagged source deployment remains the manual recovery target.
