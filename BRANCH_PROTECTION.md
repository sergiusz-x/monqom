# Branch Protection Rules

To ensure code quality and stability, the following branch protection rules are required for the `main` and `dev` branches:

1. Require pull request reviews before merging
   - Require approvals from at least 1 reviewer
   - Dismiss stale approvals when new commits are pushed
   - Require review from Code Owner (if applicable)

2. Require status checks to pass before merging
   - Required status checks: CI (the GitHub Actions workflow defined in .github/workflows/ci.yml)
   - Require branches to be up to date before merging

3. Include administrators
   - These rules apply to everyone, including repository administrators.

4. Restrict who can push to matching branches
   - Only allow specific roles or teams to push (if applicable)

5. Require linear history
   - Prevent merge commits, require rebasing or squashing

6. Allow force pushes
   - Optionally allow force pushes for designated maintainers (if needed)

These settings ensure that all changes to the main and development branches are tested and reviewed.