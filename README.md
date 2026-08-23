# agentic-rss-parser

[![npm version](https://img.shields.io/npm/v/agentic-rss-parser.svg)](https://www.npmjs.com/package/agentic-rss-parser)
[![CI](https://github.com/bluecarbons/agentic-rss-parser/actions/workflows/ci.yml/badge.svg)](https://github.com/bluecarbons/agentic-rss-parser/actions/workflows/ci.yml)
[![Node.js >= 22.5](https://img.shields.io/badge/node-%3E%3D22.5.0-339933)](./SUPPORT.md)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Wiki](https://img.shields.io/badge/docs-wiki-blueviolet)](https://github.com/bluecarbons/agentic-rss-parser/wiki)

An open-source Node.js library for parsing RSS, Atom, and JSON feeds with built-in heuristic and LLM-based relevance analysis, deduplication, HTTP conditional caching, article enrichment, a CLI, and an MCP server.

Part of the [BLUECARBONS Open Source](https://opensource.bluecarbons.com) initiative — software components powering agentic and agent-dependent products.

> **v1.7.0** — Security Hardening & Feature Expansion: Credential isolation for MCP custom base URLs, prototype pollution and DoS hardening in XML parsing, complete SSRF IANA CIDR range blocking, native JSON Feed v1/v1.1 support, Podcast & Media enclosures, persistent ETag HTTP caching, and expanded MCP tools/resources. See [CHANGELOG.md](./CHANGELOG.md) for details.

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

Exposes MCP tools and resources over stdio for Claude Desktop, Cursor, and Cline:

### Tools
- `fetch_rss_feed` — Fetch and agentically analyze an RSS, Atom, or JSON feed. Supports heuristic and LLM providers (`openai`, `anthropic`, `local`).
- `fetch_full_article` — Fetch and HTML-strip article body for context.
- `search_feed_history` — Search stored intelligence and analyses by keyword.
- `get_feed_statistics` — Retrieve metrics on processed feeds and relevance ratios.
- `prune_database` — Prune items older than TTL days.

### Resources
- `rss://analyses/latest` — Read recent relevant intelligence stored in the SQLite database.

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

- **RSS 2.0, Atom & JSON Feed** — CDATA, namespaces, HTML entities, `dc:creator`, `media:content`, `content:encoded`, and JSON Feed v1/v1.1 (`parseJsonFeed`)
- **Podcast & Media Enclosures** — extracts `<enclosure>`, `<media:thumbnail>`, and `itunes:*` metadata
- **Persistent HTTP Caching** — automatic `ETag` and `If-Modified-Since` (HTTP 304) to avoid re-fetching unchanged feeds
- **OPML Outline Parser** — extract feed URLs and categories from OPML subscriptions (`parseOpml`)
- **Polling Watcher** — continuous background watcher event emitter with status listeners (`createFeedWatcher`)
- **Database Search & Analytics** — keyword search across past analyses (`searchAnalyses`) and stats (`getStatistics`)
- **Vector DB Export** — format processed analyses directly for vector database ingestion (`exportForEmbedding`)
- **Custom Prompts & Analyzers** — configurable `systemPrompt` and `promptTemplate` for specialized evaluation
- **`rss-parser` drop-in** — zero migration cost
- **Heuristic analysis** — configurable signal scoring, no API key required
- **LLM analysis** — OpenAI, Anthropic, local (Ollama)
- **Deduplication** — SHA-256 item IDs, SQLite-backed across runs
- **Article enrichment** — fetches and HTML-strips full article body
- **MCP server** — JSON-RPC 2.0 stdio with tools and resources
- **Pluggable storage** — SQLite (Node 22.5+) or in-memory (any Node version)
- **Zero runtime dependencies** — minimal supply-chain surface

---

## Security

- XXE / Billion Laughs — iterative state-machine parser, no recursive entity expansion
- Max Nesting Depth — hard cap (128 levels) prevents stack overflow DoS
- Prototype Pollution — `Object.hasOwn` traversal and reserved key sanitization
- XSS — `<script>`, `<style>`, `<iframe>`, `<object>`, `<embed>`, `<form>` stripped from snippets
- Prompt injection — control chars stripped, newlines collapsed before LLM interpolation
- SSRF Protection — full IANA private, reserved, multicast, documentation, and 6to4 ranges blocked
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
pnpm test    # 89 passing
pnpm lint
```

---

## License

MIT © [BLUECARBONS](https://opensource.bluecarbons.com)

