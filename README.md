# agentic-rss-parser

[![npm version](https://img.shields.io/npm/v/agentic-rss-parser.svg)](https://www.npmjs.com/package/agentic-rss-parser)
[![CI](https://github.com/bluecarbons/agentic-rss-parser/actions/workflows/ci.yml/badge.svg)](https://github.com/bluecarbons/agentic-rss-parser/actions/workflows/ci.yml)
[![Node.js >= 22.5](https://img.shields.io/badge/node-%3E%3D22.5.0-339933)](./SUPPORT.md)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Wiki](https://img.shields.io/badge/docs-wiki-blueviolet)](https://github.com/bluecarbons/agentic-rss-parser/wiki)

An open-source Node.js library for parsing RSS and Atom feeds with built-in heuristic and LLM-based relevance analysis, deduplication, article enrichment, a CLI, and an MCP server.

Part of the [BLUECARBONS Open Source](https://opensource.bluecarbons.com) initiative — software components powering agentic and agent-dependent products.

> **v1.6.0** — Feature Release: introduced zero-dependency OPML subscription outline parsing (`parseOpml`), background polling event watcher (`createFeedWatcher`), vector database payload export helper (`exportForEmbedding`), and dynamic per-feed `parserOptions` resolution. See [CHANGELOG.md](./CHANGELOG.md) for details.

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

## MCP Server

Exposes `fetch_rss_feed` and `fetch_full_article` as MCP tools over stdio. `fetch_rss_feed` accepts an optional `provider` (`heuristic` | `openai` | `anthropic` | `local`) plus `apiKey` / `model` / `baseURL` — `apiKey` falls back to `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` in the server process's environment if omitted.

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
npx agentic-rss --feed https://hnrss.org/frontpage
npx agentic-rss --feed https://hnrss.org/frontpage --db ./data/my.db --fetch-full-article

# LLM-backed analysis (defaults to the heuristic analyzer when --provider is omitted)
npx agentic-rss --feed https://hnrss.org/frontpage --provider anthropic --api-key sk-ant-...
npx agentic-rss --feed https://hnrss.org/frontpage --provider openai --model gpt-4o-mini
# --api-key can be omitted if OPENAI_API_KEY / ANTHROPIC_API_KEY is set in the environment
```

---

## Key Features

- **RSS 2.0 & Atom** — CDATA, namespaces, HTML entities, `dc:creator`, `media:content`, `content:encoded`
- **OPML Outline Parser** — extract feed URLs and categories from OPML subscriptions (`parseOpml`)
- **Polling Watcher** — continuous background watcher event emitter with status listeners (`createFeedWatcher`)
- **Vector DB Export** — format processed analyses directly for vector database ingestion (`exportForEmbedding`)
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

Full documentation — installation, quick start, API reference, architecture, configuration, storage adapters, MCP server, CLI, and contributing — is available in the **[GitHub Wiki](https://github.com/bluecarbons/agentic-rss-parser/wiki)**.

---

## Development

```bash
git clone https://github.com/bluecarbons/agentic-rss-parser.git
cd agentic-rss-parser
pnpm install
pnpm test    # 75 passing
pnpm lint
```

---

## License

MIT © [BLUECARBONS](https://opensource.bluecarbons.com)
