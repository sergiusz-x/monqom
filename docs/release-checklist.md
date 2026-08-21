# Release Checklist

1. CI is green for the exact release commit, including the authenticated production-container journey.
2. The release commit has an exact v* tag; production images derive the version and SHA from that checkout.
3. Dokploy migration completes.
4. The release workflow confirms readiness and the expected commit SHA through the public domain.
5. Turnstile registration and Resend verification email are smoke tested.
6. Login, logout, password reset, CSRF rejection, rate limit, and lockout are smoke tested.
7. A backup completes and a restore drill is recorded.
8. Privacy notice and beta terms have owner approval.
9. Rollback target is identified and migration compatibility is confirmed.
