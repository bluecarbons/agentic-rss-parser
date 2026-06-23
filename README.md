# Agentic RSS Parser

[![CI](https://github.com/bluecarbons/agentic-rss-parser/actions/workflows/ci.yml/badge.svg)](https://github.com/bluecarbons/agentic-rss-parser/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/agentic-rss-parser.svg)](https://www.npmjs.com/package/agentic-rss-parser)
[![Node.js >= 22.5](https://img.shields.io/badge/node-%3E%3D22.5.0-339933)](./SUPPORT.md)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Open Source](https://img.shields.io/badge/open%20source-yes-brightgreen)](./LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/bluecarbons/agentic-rss-parser?style=social)](https://github.com/bluecarbons/agentic-rss-parser)
[![GitHub issues](https://img.shields.io/github/issues/bluecarbons/agentic-rss-parser)](https://github.com/bluecarbons/agentic-rss-parser/issues)

**Agentic RSS Parser** is an enterprise-grade, **zero-dependency** Node.js library for parsing RSS and Atom feeds, normalizing them into a familiar `Parser` API, and optionally running agentic analysis on top of feed items.

By eliminating all external production dependencies, the package minimizes your security risk surface, ensures lightning-fast installation times, and completely avoids dependency conflict hell.

---

## Why Zero-Dependency?

Traditional feed parsers and SDKs pull in dozens of nested dependencies, dragging in heavy XML parsing libraries, schema validators (`zod`), AI SDKs (`ai`, `@ai-sdk/*`), and transport layers (`@modelcontextprotocol/sdk`). This results in:
- Large bundle size & slow installations
- Higher risk of supply-chain attacks (CVEs in transitive packages)
- Complex maintenance overhead (frequent unmaintained package alerts on services like Socket.dev)

**Agentic RSS Parser solves this by using 100% native Node.js APIs:**
- **Custom XML Engine**: A clean-room, character-by-character scanner parser. It is non-recursive (no stack overflows) and does not expand external entities (making it naturally immune to XXE and Billion Laughs attacks).
- **Native JSON-RPC MCP Server**: A custom stdin/stdout transport server built directly on Node's `readline` module, matching the official MCP specification.
- **Native LLM Adapters**: Direct connection to OpenAI and Anthropic REST endpoints using Node's built-in `fetch()`.
- **Manual Schema Validation**: Zero-dependency schema checks replacing `zod`.
- **Built-in SQLite Caching**: Leveraging Node's experimental native `node:sqlite` module for deduplication.

---

## Supported Environments

- Node.js `>=22.5.0` (required for built-in `node:sqlite` module)
- ESM-only package
- Linux, macOS, and Windows

---

## Features

- **Parses RSS 2.0 & Atom Feeds**: Full support for namespaces, tags, attributes, CDATA blocks, and HTML entities.
- **Standard Parser API Compatibility**: Full drop-in replacement for the classic `rss-parser` package (`parseURL`, `parseString`, `parseFile`, `customFields`, `timeout`, `headers`, `maxRedirects`, etc.).
- **Built-in Article Enrichment**: Automatically fetches the full content of articles behind feed URLs.
- **Agentic Analysis**: Integrated heuristic and LLM analysis adapters for summarizing and assessing feed items.
- **Built-in MCP Server**: Exposes feed retrieval and full-text article extraction tools via Model Context Protocol (stdio transport).
- **SQLite Deduplication**: Prevents reprocessing of previously ingested feed items.

---

## Installation

```bash
npm install agentic-rss-parser
```

```bash
pnpm add agentic-rss-parser
```

---

## Usage

### Parsing a Feed (Standard API)

```js
import Parser from 'agentic-rss-parser';

const parser = new Parser({
  timeout: 10000,
  headers: { 'user-agent': 'my-app/1.0' }
});

const feed = await parser.parseURL('https://news.ycombinator.com/rss');
console.log(`Feed Title: ${feed.title}`);

for (const item of feed.items) {
  console.log(`- [${item.title}](${item.link})`);
}
```

### Custom Field Mapping

Map arbitrary XML attributes or child tags to custom object properties:

```js
import Parser from 'agentic-rss-parser';

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

### Agentic Workflow with LLM Summarization

Ingest feeds, deduplicate items using SQLite, extract the full web article content, and analyze the feed with OpenAI/Anthropic using zero dependencies:

```js
import { runAgenticParser } from 'agentic-rss-parser';

const results = await runAgenticParser({
  feedUrls: ['https://news.ycombinator.com/rss'],
  dbPath: './data/rss-agent.db',
  fetchFullArticle: true,
  model: {
    provider: 'openai', // 'openai' | 'anthropic' | 'local'
    model: 'gpt-4o-mini'
  }
});

for (const entry of results) {
  if (entry.analysis.decision === 'relevant') {
    console.log(`Relevant item: ${entry.item.title}`);
    console.log(`Summary: ${entry.analysis.summary}`);
  }
}
```

---

## Integration with Agentic Frameworks (e.g., Google ADK)

**Agentic RSS Parser** acts as a data pipeline component rather than a standalone orchestrator. It is designed to work in tandem with agent orchestration frameworks like **Google ADK**:

- **Feed Retrieval & Enrichment**: This package extracts raw feeds, follows redirects, normalizes entries, deduplicates via SQLite, and retrieves clean full-text article bodies.
- **Orchestration**: The agent framework (e.g., ADK) consumes these normalized, enriched JSON payloads to make decisions, run multi-agent workflows, or build memory stores.
- **MCP Tool Support**: You can easily run this parser as an MCP Server that exposes its parsing capabilities directly to any MCP-compliant agent.

Check out the [examples/](./examples/) directory for integration code:
- [examples/direct.mjs](./examples/direct.mjs): Minimal programmatic parsing.
- [examples/adk-tool.mjs](./examples/adk-tool.mjs): Wrapping the parser as a Google ADK-compatible tool.

---

## CLI Usage

```bash
npx agentic-rss --feed https://news.ycombinator.com/rss
```

Multiple feeds with caching:

```bash
npx agentic-rss \
  --feed https://news.ycombinator.com/rss \
  --feed https://hnrss.org/frontpage \
  --db ./data/rss-agent.db
```

---

## MCP Server

Expose feed parsing as a Model Context Protocol tool to your AI assistants (like Claude Desktop or any MCP client):

```bash
npx agentic-rss-mcp
```

### Supported Tools:
1. `fetch_rss_feed`: Fetch, parse, and normalize feed items from a URL.
2. `fetch_full_article`: Fetch the full text content of an article behind a link.

---

## Development & Testing

Since there are no production dependencies, development setup is instantaneous:

```bash
# Install development dependencies (testing frameworks, etc.)
npm install

# Run the automated test suite
npm test
```

---

## Security & Robustness

- **XXE Prevention**: The parser ignores DOCTYPE and ENTITY declarations, rendering XML External Entity attacks impossible.
- **Billion Laughs Prevention**: No XML entity expansion is performed, meaning recursive entity expansion DoS attacks are completely neutralized.
- **Input Sanitization**: Automatically strips `<script>` tags from summaries and item content to mitigate Cross-Site Scripting (XSS).
- **Strict Protocol Validation**: Rejects `file://`, `javascript://`, and `ftp://` links to prevent local file inclusion and server-side request forgery (SSRF).
- **Stack-Overflow Protection**: Custom XML parser handles deeply nested XML nodes iteratively (using a state machine) rather than recursively.

---

## License

MIT © Blue Carbons
