# Contributing

## Prerequisites

- Node.js ≥ 22.5.0
- pnpm (`corepack enable` then `corepack prepare pnpm@9.15.4 --activate`)
- A GitHub account with push access (or a fork)

## Local setup

```bash
git clone https://github.com/bluecarbons/agentic-rss-parser.git
cd agentic-rss-parser
pnpm install
pnpm test      # must be 61 passing before you start
```

## Branch workflow

```
main            ← always green, deployable
  └── sprint-N-pN-description   ← feature / fix branch
  └── chore/description         ← non-functional changes
  └── docs/description          ← documentation only
```

1. Branch from `main`
2. Write code + tests
3. Run `pnpm test` and `pnpm lint` — both must pass
4. Open a PR against `main`
5. Squash-merge with a conventional commit title

## Commit message format

```
<type>(<scope>): <short description>

Closes #<issue>
```

**Types:** `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `perf`

Examples:
```
fix(storage): honour item.processedAt in markProcessed
feat(parser): add maxItems config to runAgenticParser
docs(wiki): add Storage Adapters page
```

## PR checklist

- [ ] `pnpm test` passes (61/61)
- [ ] `pnpm lint` passes
- [ ] New behaviour has at least one test
- [ ] No timing-dependent tests (use `processedAt` backdate pattern)
- [ ] TypeScript declarations updated if public API changed (`src/index.d.ts`)
- [ ] `package.json` version bumped if releasing (semver: patch/minor/major)

## Versioning

This project follows [Semantic Versioning](https://semver.org/):

| Change | Bump |
|---|---|
| Bug fixes, internal refactors | patch (`1.4.0 → 1.4.1`) |
| New backwards-compatible API | minor (`1.4.0 → 1.5.0`) |
| Breaking changes | major (`1.4.0 → 2.0.0`) |

## Maintenance tasks

### Pruning old database records

```js
import { createStorage } from 'agentic-rss-parser';
const storage = createStorage('./data/rss-agent.db');
const { deletedItems, deletedAnalyses } = storage.pruneOlderThan(30); // 30-day TTL
console.log(`Pruned ${deletedItems} items, ${deletedAnalyses} analyses`);
storage.close();
```

Run this as a scheduled job (cron, GitHub Actions scheduled workflow, etc.) to keep the DB size bounded.

### Publishing a new release

```bash
# 1. Bump version in package.json
# 2. Update CHANGELOG.md
# 3. Commit and push to main
# 4. Publish
pnpm release:pnpm    # publishes to npm via pnpm
# or
pnpm release:npm
```

### Updating dependencies

```bash
pnpm update
pnpm test   # verify nothing broke
```

### Adding a new provider

1. Add the provider string to `SUPPORTED_PROVIDERS` in both `src/adapters/provider.js` and `src/mcp/server.js`
2. Add a dispatch branch in `createAnalyzer()`
3. Add the value to the `provider` enum in `src/index.d.ts`
4. Add a test in an appropriate test file
5. Document it in `wiki/Configuration.md` and `wiki/API-Reference.md`
