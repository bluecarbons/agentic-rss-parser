# Testing

## Running the test suite

```bash
# Install dependencies first
pnpm install

# Run all tests
pnpm test

# Equivalent
node --test
```

Expected output: **61 passing, 0 failing**.

## Test files

| File | What it tests |
|---|---|
| `test/parser-compat.test.js` | `ParserCompat` — rss-parser compat API, custom fields, redirect following, callback style, realistic RSS/Atom fixtures |
| `test/xml-parser.test.js` | `parseXml` — 24 edge cases: CDATA, namespaces, self-closing tags, entity decoding, quote-aware `>`, large feeds, mixed quotes |
| `test/strip-html.test.js` | `stripHtml` — 10 cases: block removal, whitespace collapse, event handler neutralisation |
| `test/storage-memory.test.js` | `createMemoryStorage` — 13 cases: all interface methods, pagination, pruning (3 boundary cases), independence |
| `test/concurrency.test.js` | `mapWithConcurrency` — all items processed exactly once; concurrency=1 and concurrency=8 produce same result set |
| `test/heuristic.test.js` | Heuristic analyser — structured decision output |

## Writing new tests

Tests use Node's built-in `node:test` runner — no external dependencies.

```js
import test from 'node:test';
import assert from 'node:assert/strict';

test('my new test', () => {
  assert.equal(1 + 1, 2);
});
```

## Deterministic patterns

### ❌ Never rely on wall-clock timing

```js
// BAD — setTimeout races with real time, flaky on slow CI
await new Promise(r => setTimeout(r, 5));
const { deletedItems } = storage.pruneOlderThan(0.000001);
```

### ✅ Use `processedAt` to backdate deterministically

```js
// GOOD — item is unconditionally older than the TTL at any machine speed
const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000).toISOString();
const item = makeItem({ processedAt: twoDaysAgo });
storage.markProcessed(item);  // createMemoryStorage honours processedAt
const { deletedItems } = storage.pruneOlderThan(1);  // 1-day TTL
assert.equal(deletedItems, 1);
```

## Lint check

```bash
pnpm lint
```

This runs `node --check` over all source files (syntax validation, no execution).
