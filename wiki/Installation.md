# Installation

## Requirements

| Requirement | Minimum | Notes |
|---|---|---|
| Node.js | **22.5.0** | Required for `node:sqlite` built-in |
| Node.js (with custom storage) | **18.x** | Use `createMemoryStorage()` or `better-sqlite3` adapter |
| npm / pnpm / yarn | any | pnpm recommended |

> **Node 18 / 20 users:** the default `createStorage()` uses `node:sqlite`, which is only available from Node 22.5.0. Supply `config.storage = createMemoryStorage()` (or a `better-sqlite3`-backed adapter) and the rest of the package works on any Node ≥ 18. See [Storage Adapters](Storage-Adapters).

## Install from npm

```bash
# npm
npm install agentic-rss-parser

# pnpm
pnpm add agentic-rss-parser

# yarn
yarn add agentic-rss-parser
```

## Install from source

```bash
git clone https://github.com/bluecarbons/agentic-rss-parser.git
cd agentic-rss-parser
pnpm install
pnpm test          # run the test suite
```

## TypeScript

TypeScript declarations ship with the package at `src/index.d.ts` — no `@types/` package needed:

```ts
import { createParser, runAgenticParser } from 'agentic-rss-parser';
// Full IntelliSense works out of the box
```

## Verifying the install

```bash
npx agentic-rss https://feeds.feedburner.com/TechCrunch
```

You should see a JSON array of `{ item, analysis }` objects printed to stdout.
