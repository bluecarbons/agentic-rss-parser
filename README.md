# Agentic RSS Parser

[![CI](https://github.com/bluecarbons/BLUECARBONS-RSS-PARSER/actions/workflows/ci.yml/badge.svg)](https://github.com/bluecarbons/BLUECARBONS-RSS-PARSER/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/agentic-rss-parser.svg)](https://www.npmjs.com/package/agentic-rss-parser)
[![Node.js >= 22.5](https://img.shields.io/badge/node-%3E%3D22.5.0-339933)](./SUPPORT.md)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Open Source](https://img.shields.io/badge/open%20source-yes-brightgreen)](./LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/bluecarbons/BLUECARBONS-RSS-PARSER?style=social)](https://github.com/bluecarbons/BLUECARBONS-RSS-PARSER)

Agentic RSS Parser is a from-scratch Node.js library for parsing RSS and Atom feeds, normalizing them into a familiar `Parser` API, and optionally running agentic analysis on top of feed items.

## Supported Environments

- Node.js `>=22.5.0`
- ESM-only package
- Linux, macOS, and Windows

Why Node.js 22.5.0 or newer:

- the project uses the built-in `node:sqlite` module
- `node:sqlite` was added in Node.js 22.5.0
- Node.js 20 does not support the current codebase

## Design Goals

- compatible migration path for `rss-parser`-style code
- small, well-documented public API
- modern XML parsing with `fast-xml-parser`
- conservative normalization for compatibility
- agentic features are opt-in, not forced
- no dependency on the deprecated `rss-parser` package

## Features

- parses RSS 2.0 and Atom feeds
- supports `Parser`, `parseURL`, `parseString`, and `parseFile`
- normalizes output into stable feed and item objects
- supports callback and promise styles
- supports `customFields`, `timeout`, `headers`, `maxRedirects`, `requestOptions`, `defaultRSS`, and `xml2js`
- deduplicates processed items with SQLite
- enriches summaries with full article text
- supports provider-backed analysis with OpenAI-compatible and Anthropic-compatible adapters
- exposes a CLI and MCP tool entrypoint

## Installation

```bash
npm install agentic-rss-parser
```

## Usage

### Parse a feed

```js
import Parser from 'agentic-rss-parser';

const parser = new Parser({
  timeout: 10000,
  headers: { 'user-agent': 'my-app/1.0' }
});

const feed = await parser.parseURL('https://news.ycombinator.com/rss');
console.log(feed.title);
```

### Use the compatibility API

```js
import Parser from 'agentic-rss-parser';

const parser = new Parser({
  customFields: {
    item: [['dc:creator', 'creator']]
  }
});

const feed = await parser.parseString(xml);
console.log(feed.items[0].creator);
```

### Callback style

```js
const parser = new Parser();

parser.parseString(xml, (err, feed) => {
  if (err) throw err;
  console.log(feed.title);
});
```

### Parse from a file

```js
import Parser from 'agentic-rss-parser';

const parser = new Parser();
const feed = await parser.parseFile('./feed.xml');
```

### Agentic workflow

```js
import { runAgenticParser } from 'agentic-rss-parser';

const results = await runAgenticParser({
  feedUrls: ['https://news.ycombinator.com/rss'],
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

## Works With Google ADK And Other Agent Frameworks

Agentic RSS Parser is designed to complement agent frameworks, not replace them.

Use it when you want:

- feed ingestion and normalization
- `rss-parser`-style compatibility for existing code
- deduplication and article enrichment
- a clean, agent-ready tool surface

It fits naturally alongside frameworks like Google ADK, where the framework handles agent orchestration and this package handles RSS and Atom data retrieval, normalization, and enrichment.

Typical integration patterns:

- call the library directly from a Node.js tool or workflow
- wrap `Parser` or `runAgenticParser` inside an ADK custom tool
- expose the parser through MCP for agent clients that prefer tool protocols

Mental model:

- ADK decides what to do
- Agentic RSS Parser gathers, normalizes, deduplicates, and enriches the feed data
- ADK or another orchestrator uses the structured result to continue the workflow

For a concrete starting point, see:

- [`examples/direct.mjs`](./examples/direct.mjs)
- [`examples/adk-tool.mjs`](./examples/adk-tool.mjs)

## Migration From `rss-parser`

Most existing code can switch imports with minimal changes:

```js
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
- namespaced fields like `dc:creator` and `content:encoded`
- repeated tags, attributes, and CDATA

The compatibility layer normalizes output into familiar feed and item objects while preserving the agentic feature set.

## CLI

```bash
npx agentic-rss-parser --feed https://news.ycombinator.com/rss
```

Multiple feeds:

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

## Parallelism

Agentic RSS Parser does not currently run a swarm-style parallel orchestration layer on its own.

What it does support:

- you can call it multiple times from your own code in parallel when that makes sense
- you can wrap it in an ADK workflow that uses parallel agents or parallel tool calls
- you can manage concurrency at the orchestration layer instead of inside the parser

What it does not do yet:

- automatic swarm scheduling
- distributed scraping coordination
- cross-feed task planning

## Development

```bash
npm install
npm test
```

## Package Health

- pinned Node.js support is documented in [SUPPORT.md](./SUPPORT.md)
- dependency updates should be reviewed before release
- `npm audit` should stay clean before merging

## Project Structure

- `src/core/parser.js`: XML parsing and normalization
- `src/core/http.js`: redirect-aware feed fetching
- `src/compat.js`: `Parser` compatibility surface
- `src/parser.js`: agentic feed pipeline
- `src/adapters/provider.js`: model provider adapters
- `src/mcp/server.js`: MCP entrypoint

## Security

- only fetch trusted feed URLs
- keep model-provider API keys out of source control
- review custom XML feeds before processing them in production
- see [SECURITY.md](./SECURITY.md) for vulnerability reporting

## Contributing

Please read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a pull request.

Please also review the [Code of Conduct](./CODE_OF_CONDUCT.md) before participating.
