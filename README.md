# Agentic RSS Parser

[![CI](https://github.com/bluecarbons/BLUECARBONS-RSS-PARSER/actions/workflows/ci.yml/badge.svg)](https://github.com/bluecarbons/BLUECARBONS-RSS-PARSER/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/agentic-rss-parser.svg)](https://www.npmjs.com/package/agentic-rss-parser)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

Agentic RSS Parser is a from-scratch Node.js library for reading RSS and Atom feeds, normalizing them into a familiar parser API, and optionally running agentic analysis on top of the feed items.

It is designed for three use cases:

- as a drop-in migration path for `rss-parser`-style code
- as a programmatic feed engine for Node.js and TypeScript apps
- as an agent-facing tool layer for workflows, automations, and IDE integrations

Built-in principles:

- modern XML parsing using `fast-xml-parser`
- conservative normalization for compatibility
- opt-in agentic behavior, never forced
- small public surface area with documented defaults
- no dependency on the deprecated `rss-parser` package

## What It Does

- parses RSS 2.0 and Atom feeds
- returns normalized feed and item objects
- supports `Parser`, `parseURL`, `parseString`, and `parseFile`
- keeps item deduplication in SQLite for agentic workflows
- fetches full article text when summaries are too short
- supports provider-based analysis with OpenAI-compatible and Anthropic-compatible adapters
- exposes an MCP transport for agent-friendly integrations

## Installation

```bash
npm install agentic-rss-parser
```

## Quick Start

```js
import Parser, { runAgenticParser } from 'agentic-rss-parser';

const parser = new Parser({
  timeout: 10000,
  headers: { 'user-agent': 'my-app/1.0' }
});

const feed = await parser.parseURL('https://news.ycombinator.com/rss');
console.log(feed.title);

const results = await runAgenticParser({
  feedUrls: ['https://news.ycombinator.com/rss'],
  dbPath: './data/rss-agent.db',
  fetchFullArticle: false
});

console.log(results.length);
```

## API

The package exports a `Parser` class for migration-friendly code paths.

```js
import Parser from 'agentic-rss-parser';

const parser = new Parser({
  customFields: {
    feed: ['foo'],
    item: [['dc:creator', 'creator']]
  },
  timeout: 1000,
  headers: { 'User-Agent': 'my-app' }
});

const feed = await parser.parseURL('https://www.reddit.com/.rss');
console.log(feed.title);
console.log(feed.items[0].title);
```

Callback style is supported for compatibility:

```js
const parser = new Parser();
parser.parseString(xml, (err, feed) => {
  if (err) throw err;
  console.log(feed.title);
});
```

### Migration From `rss-parser`

Most existing code should keep working with a one-line import change:

```js
// Before
import Parser from 'rss-parser';

// After
import Parser from 'agentic-rss-parser';
```

Supported compatibility surface:

- `new Parser(options)`
- `parseURL(url[, callback])`
- `parseString(xml[, callback])`
- `parseFile(path[, callback])`
- `customFields`
- `timeout`
- `headers`
- `maxRedirects`
- `requestOptions`
- `defaultRSS`
- `xml2js`

Supported XML shapes:

- RSS 2.0 feeds with `<item>` entries
- Atom feeds with `<entry>` entries
- common namespaced fields like `dc:creator` and `content:encoded`
- feeds with repeated tags, attributes, and CDATA

The compatibility layer is intentionally conservative: it normalizes output into familiar `rss-parser`-style feed and item objects while keeping the agentic features available through the same package.

Agentic features remain opt-in:

- `parseFeed(...)`
- provider-based analysis
- deduplication storage
- MCP tool server

## Agentic Features

The agentic workflow is built for higher-level automation:

- dedupe items by stable IDs
- enrich short summaries with full article text
- classify feeds via pluggable model providers
- persist processed state in SQLite
- emit structured analysis objects for downstream routing

Example:

```js
import { runAgenticParser } from 'agentic-rss-parser';

const results = await runAgenticParser({
  feedUrls: [
    'https://news.ycombinator.com/rss',
    'https://hnrss.org/frontpage'
  ],
  dbPath: './data/rss-agent.db',
  fetchFullArticle: true,
  model: {
    provider: 'openai',
    model: 'gpt-4o-mini'
  }
});

for (const entry of results) {
  if (entry.analysis.decision === 'relevant') {
    console.log(entry.analysis.summary);
  }
}
```

## CLI

```bash
npx agentic-rss-parser --feed https://news.ycombinator.com/rss
```

Multiple feeds are supported:

```bash
npx agentic-rss-parser \
  --feed https://news.ycombinator.com/rss \
  --feed https://hnrss.org/frontpage \
  --db ./data/rss-agent.db
```

## MCP Tooling

```bash
npx agentic-rss-mcp --feed https://news.ycombinator.com/rss
```

This project exposes an MCP server entrypoint for agent-facing clients. The implementation is intentionally minimal and can be wired into desktop or automation clients that speak stdio-based tool protocols.

## Development

```bash
npm install
npm test
```

## Project Structure

- `src/core/parser.js`: XML parsing and normalization
- `src/compat.js`: `rss-parser` compatibility surface
- `src/parser.js`: agentic feed pipeline
- `src/adapters/provider.js`: model provider adapters
- `src/mcp/server.js`: MCP entrypoint

## Implementation Notes

- feed fetching uses native `fetch`
- parser requests support headers, request options, and timeout handling
- output is normalized into stable feed/item objects instead of exposing raw XML shapes
- SQLite is used only for deduplication and analysis persistence

## Security

- only fetch trusted feed URLs
- keep model-provider API keys out of source control
- review custom XML feeds before processing them in production

## Contributing

Please read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a pull request.

## Roadmap

- pluggable LLM analyzers
- official MCP protocol transport
- OPML import/export
- feed health monitoring
- webhook and queue integrations
