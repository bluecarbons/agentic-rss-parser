# Agentic RSS Parser

[![CI](https://github.com/bluecarbons/agentic-rss-parser/actions/workflows/ci.yml/badge.svg)](https://github.com/bluecarbons/agentic-rss-parser/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/agentic-rss-parser.svg)](https://www.npmjs.com/package/agentic-rss-parser)
[![Node.js >= 22.5](https://img.shields.io/badge/node-%3E%3D22.5.0-339933)](./SUPPORT.md)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Open Source](https://img.shields.io/badge/open%20source-yes-brightgreen)](./LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/bluecarbons/agentic-rss-parser?style=social)](https://github.com/bluecarbons/agentic-rss-parser)
[![GitHub issues](https://img.shields.io/github/issues/bluecarbons/agentic-rss-parser)](https://github.com/bluecarbons/agentic-rss-parser/issues)

**Agentic RSS Parser** is an enterprise-grade Node.js library for parsing RSS and Atom feeds. It provides a familiar `rss-parser`-compatible API while adding agentic analysis, deduplication, enrichment, and multi-SDK tool integration.

The production runtime is intentionally small and auditable. It uses a minimal set of direct dependencies for XML parsing, schema validation, and provider integrations, and it keeps network access explicit and configurable. Safe to deploy in security-sensitive environments when used with the documented security controls.

> **Version 1.3.5** — Quote-aware XML tag scanner, corrected confidence polarity for heuristic ignore decisions, nullable `link` column in SQLite, safe Anthropic JSON parse, clean MCP URL validation errors, and full SDK integration examples for Anthropic, OpenAI Agents, Vercel AI SDK, LangChain, and Google ADK.

---

## Migration from `rss-parser`

If you are currently using the [`rss-parser`](https://www.npmjs.com/package/rss-parser) npm package, migration is a one-line change:

```js
// Before
import Parser from 'rss-parser';

// After — zero other changes needed
import Parser from 'agentic-rss-parser';
```

All existing `parseURL`, `parseString`, `parseFile`, `customFields`, `headers`, `timeout`, and callback-style usage is preserved exactly. The agentic pipeline (`parseFeed`, `runAgenticParser`) is an optional extension on top.

The compatibility layer is intentionally explicit about its trust boundaries:

- `parseURL()` only accepts `http:` and `https:` URLs and rejects private/loopback targets.
- `parseFile()` reads local filesystem paths only and rejects URL-like inputs.
- `parseFeed()` forwards only validated feed URLs into the agentic pipeline.

---

## Why a Minimal Dependency Surface?

Traditional feed parsers pull in dozens of nested dependencies. `rss-parser` has not received a security update since 2022. **Agentic RSS Parser** reduces supply-chain risk by keeping the dependency surface small and intentional:

- **Custom XML Engine** — Non-recursive, character-by-character scanner with quote-aware attribute parsing. Naturally immune to XXE and Billion Laughs attacks.
- **Native JSON-RPC MCP Server** — Custom stdin/stdout transport built on Node's `readline` module.
- **Native LLM Adapters** — Direct connection to OpenAI and Anthropic REST endpoints using built-in `fetch()`.
- **Explicit schema validation** — Lightweight validation layer for analysis responses.
- **Built-in SQLite caching** — Native `node:sqlite` module for deduplication.

---

## Supported Environments

- Node.js `>=22.5.0` (required for `node:sqlite`)
- ESM-only package
- Linux, macOS, Windows

---

## Features

- **RSS 2.0 & Atom** — Namespaces, CDATA, HTML entities, `dc:creator`, `media:content`, `content:encoded`
- **`rss-parser` drop-in** — `parseURL`, `parseString`, `parseFile`, `customFields`, callback style, promise style
- **Configurable heuristic analysis** — Signal-based relevance scoring, no API key needed. Fully customisable via `signals`, `extraSignals`, and `threshold`
- **LLM analysis** — OpenAI, Anthropic, and local (Ollama) providers via native `fetch()`
- **Article enrichment** — Fetches and strips full article body from feed item URLs
- **MCP server** — stdio JSON-RPC 2.0 server exposing `fetch_rss_feed` and `fetch_full_article` tools; works with Claude Desktop, Cursor, VS Code, and any MCP-compliant host
- **SQLite deduplication** — Items are SHA-256 deduplicated across runs
- **SDK integrations** — Ready-to-use examples for Anthropic SDK, OpenAI Agents SDK, Vercel AI SDK, LangChain, and Google ADK
- **`userAgent` option** — Override the default UA to avoid 403s on feeds that block bot user-agents

---

## Installation

```bash
npm install agentic-rss-parser
# or
pnpm add agentic-rss-parser
```

> Zero `dependencies` at runtime. Optional peer packages (`@anthropic-ai/sdk`, `@openai/agents`, `ai`, etc.) are only needed if you use the corresponding SDK integration examples — they are not required for core parsing, heuristic analysis, or the MCP server.

---

## Usage

### Standard Parsing (rss-parser compatible)

```js
import Parser from 'agentic-rss-parser';

const parser = new Parser({
  timeout: 10000,
  headers: { 'user-agent': 'my-app/1.0' }
});

const feed = await parser.parseURL('https://news.ycombinator.com/rss');
console.log(`Feed: ${feed.title}`);

for (const item of feed.items) {
  console.log(`- ${item.title} — ${item.link}`);
}
```

### Bypass 403 Blocks with a Custom User-Agent

Some feeds (Reddit, HN, Lobste.rs) return 403 to bot user-agents. Use the `userAgent` option:

```js
const parser = new Parser({
  userAgent: 'Mozilla/5.0 (compatible; MyReader/1.0)'
});

const feed = await parser.parseURL('https://www.reddit.com/r/programming/.rss');
```

### Custom Field Mapping

```js
const parser = new Parser({
  customFields: {
    item: [
      ['dc:creator', 'creator'],
      ['media:content', 'media', { keepArray: true }]
    ]
  }
});

const feed = await parser.parseString(xmlString);
console.log(feed.items[0].creator);
```

---

## Agentic Pipeline

### Default Heuristic Analysis (No API Key)

Analyses items using a configurable signal-matching engine. No LLM or API key required.

```js
import { runAgenticParser } from 'agentic-rss-parser';

const { results, feedErrors } = await runAgenticParser({
  feedUrls: ['https://news.ycombinator.com/rss'],
  dbPath: './data/rss-agent.db'
  // model defaults to { provider: 'heuristic' }
});

for (const { item, analysis } of results) {
  if (analysis.decision === 'relevant') {
    console.log(`[${analysis.confidence}%] ${item.title}`);
    console.log(`Summary: ${analysis.summary}`);
    console.log(`Tags: ${analysis.tags.join(', ')}`);
  }
}
```

### Configuring Heuristic Signals

The default signal list is developer/tech-tool focused. Customise it for your domain:

```js
import { DEFAULT_HEURISTIC_SIGNALS, runAgenticParser } from 'agentic-rss-parser';

console.log(DEFAULT_HEURISTIC_SIGNALS);
// ['release', 'security', 'vulnerability', 'node', 'javascript', ...]

// Option 1 — Extend defaults with extra signals
const { results } = await runAgenticParser({
  feedUrls: ['https://techcrunch.com/feed'],
  dbPath: './data/rss-agent.db',
  model: {
    provider: 'heuristic',
    extraSignals: ['funding', 'acquisition', 'launch', 'series'],
    threshold: 2  // lower threshold for broader recall
  }
});

// Option 2 — Replace defaults entirely (e.g. for a startup intelligence feed)
const { results: startupResults } = await runAgenticParser({
  feedUrls: ['https://techcrunch.com/feed'],
  dbPath: './data/rss-agent.db',
  model: {
    provider: 'heuristic',
    signals: ['funding', 'series', 'yc', 'ipo', 'acquisition', 'launch', 'ai', 'b2b'],
    threshold: 1
  }
});
```

### LLM Analysis

```js
const { results, feedErrors } = await runAgenticParser({
  feedUrls: ['https://news.ycombinator.com/rss'],
  dbPath: './data/rss-agent.db',
  fetchFullArticle: true,
  model: {
    provider: 'anthropic', // 'openai' | 'anthropic' | 'local' | 'heuristic'
    model: 'claude-sonnet-4-6',
    apiKey: 'sk-ant-...' // pass explicitly for provider-backed analysis
  }
});

if (feedErrors.length) {
  console.error('Feed errors:', feedErrors);
}
```

### Direct `heuristicAnalyze` Usage

```js
import { heuristicAnalyze, resolveSignals } from 'agentic-rss-parser';

// Inspect the resolved signal list before running
console.log(resolveSignals({ extraSignals: ['funding', 'launch'] }));

const analysis = heuristicAnalyze(
  { title: 'Stripe raises $1B Series H', contentSnippet: 'Fintech giant...' },
  '',
  { signals: ['funding', 'series', 'raise', 'valuation'], threshold: 1 }
);
// { decision: 'relevant', confidence: 55, tags: ['funding', 'series'], ... }
```

---

## SDK Integrations

### Claude Desktop / MCP Hosts

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "rss": {
      "command": "npx",
      "args": ["agentic-rss-parser@latest", "mcp"]
    }
  }
}
```

Once connected, Claude (or any MCP-compliant host) can call `fetch_rss_feed` and `fetch_full_article` as native tools.

### Anthropic SDK (Direct)

See [`examples/anthropic-sdk.mjs`](./examples/anthropic-sdk.mjs) for a full agentic loop using `@anthropic-ai/sdk` with multi-step `tool_use` cycling. The example configures the client with an explicit `apiKey` so the integration path stays clear and auditable.

### OpenAI Agents SDK

See [`examples/openai-agents-sdk.mjs`](./examples/openai-agents-sdk.mjs) — uses `@openai/agents` `tool()` and `Agent`.

### Vercel AI SDK

See [`examples/vercel-ai-sdk.mjs`](./examples/vercel-ai-sdk.mjs) — uses `ai` + `@ai-sdk/anthropic` with `generateText` and `maxSteps: 5`.

### LangChain

See [`examples/langchain-js.mjs`](./examples/langchain-js.mjs) — wraps `fetch_rss_feed` as a LangChain `DynamicTool` and binds it to a `ChatAnthropic` agent via `createToolCallingAgent`.

### Google ADK

See [`examples/adk-real.mjs`](./examples/adk-real.mjs) — wraps the parser as a `FunctionTool` for `LlmAgent`.

---

## CLI Usage

```bash
npx agentic-rss --feed https://news.ycombinator.com/rss
```

Multiple feeds with a persistent cache:

```bash
npx agentic-rss \
  --feed https://news.ycombinator.com/rss \
  --feed https://hnrss.org/frontpage \
  --db ./data/rss-agent.db
```

---

## MCP Server

Expose feed parsing as Model Context Protocol tools:

```bash
npx agentic-rss-mcp
```

**Available tools:**

| Tool | Description |
|---|---|
| `fetch_rss_feed` | Fetch and analyse an RSS or Atom feed. Returns `decision`, `confidence`, `summary`, `impact`, `actionItems`, `tags` per item. Accepts `url`, `limit`, `provider`. |
| `fetch_full_article` | Fetch the full plain-text body of an article URL, HTML stripped. |

---

## API Reference

### `new Parser(options?)`

Drop-in replacement for `rss-parser`. All options are compatible.

| Option | Type | Default | Description |
|---|---|---|---|
| `timeout` | `number` | `10000` | Request timeout in ms |
| `maxRedirects` | `number` | `5` | Max HTTP redirects to follow |
| `headers` | `Record<string, string>` | — | Additional request headers |
| `userAgent` | `string` | `agentic-rss-parser/<version>` | Override the User-Agent |
| `customFields` | `CustomFieldConfig` | — | Map extra XML fields to item properties |
| `normalize` | `boolean` | `true` | Normalise output shape |

**Methods:** `parseURL(url)`, `parseString(xml)`, `parseFile(path)`, `parseFeed(urls, config?)`

---

### `runAgenticParser(config)`

Runs the full pipeline: fetch → parse → deduplicate → analyse.

Returns `{ results: Array<{ item, analysis }>, feedErrors: FeedError[] }`.

| Config key | Type | Default | Description |
|---|---|---|---|
| `feedUrls` | `string[]` | — | Feed URLs to process |
| `dbPath` | `string` | `./data/rss-agent.db` | SQLite cache path |
| `fetchFullArticle` | `boolean` | `false` | Fetch full article body per item |
| `concurrency` | `number` | `1` | Max parallel feed workers (max 16) |
| `model.provider` | `string` | `'heuristic'` | `'heuristic'` \| `'openai'` \| `'anthropic'` \| `'local'` |
| `model.model` | `string` | provider default | Model ID string |
| `model.apiKey` | `string` | required for `openai`/`anthropic` | Override API key |
| `model.signals` | `string[]` | — | Replace default heuristic signals |
| `model.extraSignals` | `string[]` | — | Extend default heuristic signals |
| `model.threshold` | `number` | `3` | Signal score needed to mark 'relevant' |
| `model.retries` | `number` | `2` | HTTP retry attempts on 429/5xx responses |

---

### `createStorage(dbPath)`

Instantiates a SQLite-backed storage database helper.

Returns an object with database operations:

- `hasProcessed(id)`: Returns a boolean indicating if a feed item hash was already processed.
- `markProcessed(item)`: Saves a feed item to the `processed_items` cache table.
- `saveAnalysis(itemId, analysis)`: Saves structured analysis results for an item.
- `getAnalyses(options?)`: Query stored analyses with optional filtering and pagination. Returns `StorageAnalysisRow[]`.
  - `options.feedUrl`: Filter to a specific feed URL.
  - `options.decision`: Filter by decision (`'relevant'` or `'ignore'`).
  - `options.limit`: Max rows to return (default: 50, max: 1000).
  - `options.offset`: Offset for pagination.
- `pruneOlderThan(ttlDays)`: Delete cache entries and analyses older than `ttlDays` (must be `> 0`). Returns `{ deletedItems: number, deletedAnalyses: number }`.
- `close()`: Closes the SQLite database connection.

---

### `heuristicAnalyze(item, context?, options?)`

Direct heuristic analysis. No async, no API key.

| Option | Type | Default | Description |
|---|---|---|---|
| `signals` | `string[]` | `DEFAULT_HEURISTIC_SIGNALS` | Full signal replacement |
| `extraSignals` | `string[]` | — | Appended to defaults |
| `threshold` | `number` | `3` | Score needed for `'relevant'` |

---

### `DEFAULT_HEURISTIC_SIGNALS`

The built-in signal list (dev/tech-focused). Exported for inspection:

```js
import { DEFAULT_HEURISTIC_SIGNALS } from 'agentic-rss-parser';
// ['release', 'security', 'vulnerability', 'node', 'javascript',
//  'typescript', 'framework', 'api', 'breaking', 'performance', 'agent', 'rss']
```

---

### `resolveSignals(options?)`

Returns the effective signal list given the options object. Useful for debugging signal config before running a pipeline.

```js
import { resolveSignals } from 'agentic-rss-parser';

resolveSignals({ extraSignals: ['funding'] });
// [...DEFAULT_HEURISTIC_SIGNALS, 'funding']

resolveSignals({ signals: ['ai', 'launch'] });
// ['ai', 'launch']
```

---

## Development & Testing

```bash
git clone https://github.com/bluecarbons/agentic-rss-parser.git
cd agentic-rss-parser
npm install  # installs dev deps only — zero runtime dependencies
npm test     # runs all tests via Node's built-in test runner
npm run lint # syntax-checks all source files
```

---

## Security

- **XXE / Billion Laughs** — DOCTYPE and ENTITY declarations ignored; entity expansion never performed
- **XSS mitigation** — `<script>`, `<iframe>`, `<object>`, `<embed>`, `<form>` stripped from `contentSnippet`
- **Prompt injection** — Feed content sanitised (control chars stripped, newlines collapsed) before LLM interpolation
- **Response size cap** — Feed responses capped at 5 MB; LLM responses at 1 MB
- **SSRF** — `file://`, `javascript://`, `ftp://` and all non-HTTP(S) schemes rejected; RFC-1918 private ranges (10.x, 172.16–31.x, 192.168.x), loopback (127.x, ::1), link-local (169.254.x), and IPv6 ULA (fc00::/7) are blocked on every request and redirect hop
- **Stack overflow** — XML parsed iteratively (state machine), not recursively
- **Supply-chain** — Small, intentional dependency surface; outbound network access is explicit and documented

See [SECURITY.md](./SECURITY.md) for the vulnerability disclosure policy.

---

## License

MIT © Blue Carbons
