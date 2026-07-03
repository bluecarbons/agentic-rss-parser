# agentic-rss-parser Wiki

Welcome to the official documentation for **agentic-rss-parser v1.4.0** — an open-source, Node.js RSS/Atom parser with built-in heuristic and LLM-based relevance analysis, deduplication, enrichment, pluggable storage, a CLI, and an MCP server.

## Pages

| Page | What it covers |
|---|---|
| [Installation](Installation) | npm / pnpm install, Node version requirements |
| [Quick Start](Quick-Start) | Working code examples in 5 minutes |
| [Architecture](Architecture) | Module map, data-flow, design decisions |
| [API Reference](API-Reference) | Every exported function and class, with signatures |
| [Configuration](Configuration) | All config knobs — concurrency, providers, signals, timeouts |
| [Storage Adapters](Storage-Adapters) | SQLite adapter, in-memory adapter, custom adapters |
| [MCP Server](MCP-Server) | Running as a Model Context Protocol tool server |
| [CLI](CLI) | `agentic-rss` command-line usage |
| [Testing](Testing) | Running tests, writing new ones, deterministic patterns |
| [Contributing](Contributing) | Branch workflow, PR checklist, sprint conventions |
| [Changelog](Changelog) | Version history |

## At a Glance

```
npm install agentic-rss-parser
```

```js
import { createParser } from 'agentic-rss-parser';

const parser = createParser();
const results = await parser.parseFeed('https://example.com/feed.xml');

for (const { item, analysis } of results) {
  console.log(analysis.decision, analysis.confidence, item.title);
}
```

No API key required — the default `heuristic` provider works offline.
