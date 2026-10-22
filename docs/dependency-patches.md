# Dependency security patches

`braces@3.0.3` has a local pnpm patch that rejects brace/parenthesis nesting beyond
100 AST levels before recursive processing. Ordinary glob patterns are unchanged.
The patch is applied through `pnpm.patchedDependencies` and verified by
`pnpm run check:dependency-patches` in CI before dependency audits.

The registry currently reports no patched version for
[CVE-2026-93687](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).
`pnpm.auditConfig.ignoreCves` excludes only that identifier because npm's audit
service cannot recognize the local patch. The patch regression check must remain
mandatory while this exception exists. Remove the patch, exception and regression
fixture together when an upstream release fixes the issue.
