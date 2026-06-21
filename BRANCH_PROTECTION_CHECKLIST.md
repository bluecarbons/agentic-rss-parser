# Branch Protection Checklist

Use this checklist when configuring protection for `main` in GitHub.

## Required Rules

- require pull request reviews before merging
- require status checks to pass before merging
- require branches to be up to date before merging
- require conversation resolution before merging
- restrict pushes to maintainers only

## Recommended Status Checks

- `npm test`
- `npm audit`
- GitHub Actions CI

## Recommended Merge Policy

- squash merge for small, focused changes
- no direct pushes to `main`
- require a PR summary that explains user impact

## Notes

- keep release commits separate from feature commits when possible
- delete merged branches automatically
- avoid merging if the Node support policy is not updated
