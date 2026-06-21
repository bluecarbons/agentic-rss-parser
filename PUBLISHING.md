# Publishing

Use this guide when releasing a new version of `agentic-rss-parser`.

## Before You Publish

- run `npm test`
- run `npm audit`
- review [`RELEASE_CHECKLIST.md`](./RELEASE_CHECKLIST.md)
- confirm the version in `package.json`
- confirm the repo URLs still point to `bluecarbons/agentic-rss-parser`

## Dry Runs

```bash
npm pack --dry-run
npm publish --dry-run
corepack pnpm publish --dry-run --access public
```

## Publish to npm

```bash
npm login
npm publish --access public
```

## Publish with pnpm

```bash
corepack pnpm publish --access public
```

## Notes

- npm credentials are required for the actual publish step
- `publishConfig.access` is already set to `public`
- the package is configured for ESM and requires Node.js `>=22.5.0`
- the CLI shims are included at the package root for clean publishing
