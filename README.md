# agentic-rss-parser

[![npm version](https://img.shields.io/npm/v/agentic-rss-parser.svg)](https://www.npmjs.com/package/agentic-rss-parser)
[![CI](https://github.com/bluecarbons/agentic-rss-parser/actions/workflows/ci.yml/badge.svg)](https://github.com/bluecarbons/agentic-rss-parser/actions/workflows/ci.yml)
[![Node.js >= 22.5](https://img.shields.io/badge/node-%3E%3D22.5.0-339933)](./SUPPORT.md)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Wiki](https://img.shields.io/badge/docs-wiki-blueviolet)](https://github.com/bluecarbons/agentic-rss-parser/wiki)

An open-source Node.js library for parsing RSS and Atom feeds with built-in heuristic and LLM-based relevance analysis, deduplication, article enrichment, a CLI, and an MCP server.

Part of the [BLUECARBONS Open Source](https://opensource.bluecarbons.com) initiative — software components powering agentic and agent-dependent products.

> **v1.4.0** — `maxItems` config, `feedErrors` surface, MCP in-process throttling, `DEFAULT_DB_PATH` deduplication, unquoted XML attribute support, `tools.js` consolidation.

---

## Installation

```bash
npm install agentic-rss-parser
# or
pnpm add agentic-rss-parser
```

Requires Node.js `>=22.5.0` (for `node:sqlite`). On Node 18/20, pass `storage: createMemoryStorage()` — everything else works unchanged.

---

## Migration from `rss-parser`

One-line change:

```js
// Before
import Parser from 'rss-parser';

// After — all existing usage unchanged
import Parser from 'agentic-rss-parser';
```

All `parseURL`, `parseString`, `parseFile`, `customFields`, and callback-style APIs are preserved exactly.

---

## Quick Start

```js
import { createParser } from 'agentic-rss-parser';

const parser = createParser();
const results = await parser.parseFeed('https://hnrss.org/frontpage');

for (const { item, analysis } of results) {
  if (analysis.decision === 'relevant') {
    console.log(`[${analysis.confidence}%] ${item.title}`);
    console.log('Tags:', analysis.tags.join(', '));
  }
}

// Errors per feed are surfaced separately
if (results.feedErrors?.length) console.warn(results.feedErrors);
```

No API key needed — the default `heuristic` provider works fully offline.

---

## Providers

```js
// OpenAI
await parser.parseFeed(url, {
  model: { provider: 'openai', apiKey: process.env.OPENAI_API_KEY }
});

// Anthropic
await parser.parseFeed(url, {
  model: { provider: 'anthropic', apiKey: process.env.ANTHROPIC_API_KEY }
});

// Local Ollama
await parser.parseFeed(url, {
  model: { provider: 'local', baseURL: 'http://localhost:11434/v1', model: 'llama3' }
});

// Custom heuristic signals
await parser.parseFeed(url, {
  model: { provider: 'heuristic', extraSignals: ['funding', 'launch'], threshold: 2 }
});
```

---

## MCP Server

Exposes `fetch_rss_feed` and `fetch_full_article` as MCP tools over stdio.

```bash
npx agentic-rss-mcp
```

Claude Desktop config (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "agentic-rss": {
      "command": "npx",
      "args": ["agentic-rss-mcp"]
    }
  }
}
```

---

## CLI

```bash
npx agentic-rss https://hnrss.org/frontpage
npx agentic-rss https://hnrss.org/frontpage --provider openai --limit 5
```

---

## Key Features

- **RSS 2.0 & Atom** — CDATA, namespaces, HTML entities, `dc:creator`, `media:content`, `content:encoded`
- **`rss-parser` drop-in** — zero migration cost
- **Heuristic analysis** — configurable signal scoring, no API key required
- **LLM analysis** — OpenAI, Anthropic, local (Ollama)
- **Deduplication** — SHA-256 item IDs, SQLite-backed across runs
- **Article enrichment** — fetches and HTML-strips full article body
- **MCP server** — JSON-RPC 2.0 stdio, works with Claude Desktop, Cursor, Cline
- **Pluggable storage** — SQLite (Node 22.5+) or in-memory (any Node version)
- **Custom analyzer** — bring your own `({ item, context }) => AnalysisResult` function
- **Zero runtime dependencies** — minimal supply-chain surface

---

## Security

- XXE / Billion Laughs — iterative state-machine parser, no recursive entity expansion
- XSS — `<script>`, `<style>`, `<iframe>`, `<object>`, `<embed>`, `<form>` stripped from snippets
- Prompt injection — control chars stripped, newlines collapsed before LLM interpolation
- SSRF — `file://`, `javascript://`, RFC-1918, loopback, and link-local targets rejected
- Response size cap — feed responses 5 MB max, LLM responses 1 MB max

See [SECURITY.md](./SECURITY.md) for the vulnerability disclosure policy.

---

## Documentation

Full documentation is available in the **[GitHub Wiki](https://github.com/bluecarbons/agentic-rss-parser/wiki)**:

- [Installation](https://github.com/bluecarbons/agentic-rss-parser/wiki/Installation)
- [Quick Start](https://github.com/bluecarbons/agentic-rss-parser/wiki/Quick-Start)
- [Architecture](https://github.com/bluecarbons/agentic-rss-parser/wiki/Architecture)
- [API Reference](https://github.com/bluecarbons/agentic-rss-parser/wiki/API-Reference)
- [Configuration](https://github.com/bluecarbons/agentic-rss-parser/wiki/Configuration)
- [Storage Adapters](https://github.com/bluecarbons/agentic-rss-parser/wiki/Storage-Adapters)
- [MCP Server](https://github.com/bluecarbons/agentic-rss-parser/wiki/MCP-Server)
- [CLI](https://github.com/bluecarbons/agentic-rss-parser/wiki/CLI)
- [Contributing](https://github.com/bluecarbons/agentic-rss-parser/wiki/Contributing)

---

## Development

```bash
git clone https://github.com/bluecarbons/agentic-rss-parser.git
cd agentic-rss-parser
pnpm install
pnpm test    # 61 passing
pnpm lint
```

---

## License

MIT © [BLUECARBONS](https://opensource.bluecarbons.com)
