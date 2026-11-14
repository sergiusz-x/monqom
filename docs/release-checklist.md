# Release Checklist

After CI succeeds on a push to `main`, semantic-release publishes a version when the commits
require one. Release tags are immutable; publish a new version instead of moving a tag.

1. CI is green for the exact release commit, including the authenticated production-container journey.
2. The release commit has an exact v* tag; production images derive the version and SHA from that checkout.
3. Dokploy migration completes.
4. The release workflow confirms readiness and the expected commit SHA through the public domain.
5. Turnstile registration and Resend verification email are smoke tested.
6. Login, logout, password reset, CSRF rejection, rate limit, and lockout are smoke tested.
7. A backup completes and a restore drill is recorded.
8. Privacy notice and terms have owner approval and match the deployed service. Confirm
   processor agreements and transfers, tested request handling, retention and deletion after
   backup restoration before publishing privacy commitments.
9. Rollback target is identified and migration compatibility is confirmed.

- [ ] Run `pnpm screenshots` and review the generated PL and EN images before committing them.
