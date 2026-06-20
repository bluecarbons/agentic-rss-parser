# Agentic RSS Parser

[![CI](https://github.com/bluecarbons/BLUECARBONS-RSS-PARSER/actions/workflows/ci.yml/badge.svg)](https://github.com/bluecarbons/BLUECARBONS-RSS-PARSER/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/agentic-rss-parser.svg)](https://www.npmjs.com/package/agentic-rss-parser)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

An open-source Node.js library and tool for parsing RSS feeds in agent-driven workflows.

This parser is built from scratch on top of `fast-xml-parser`, not the deprecated `rss-parser` package.

It is designed for three use cases:

- direct programmatic use from Node.js or TypeScript
- CLI usage for quick feed runs
- MCP-style tool execution for agentic clients and IDEs

## Features

- RSS/Atom feed ingestion
- deduplication with native `node:sqlite`
- optional full-article enrichment
- structured analysis output
- CLI entrypoint
- library exports for npm consumption

## Install

```bash
npm install agentic-rss-parser
```

## Use as a library

```js
import { runAgenticParser } from 'agentic-rss-parser';

const results = await runAgenticParser({
  feedUrls: ['https://news.ycombinator.com/rss'],
  dbPath: './data/rss-agent.db',
  fetchFullArticle: false
});

console.log(results);
```

## Drop-in replacement mode

The package also exports a `Parser` class with the same core usage pattern as `rss-parser`.

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

You can also use callback style:

```js
const parser = new Parser();
parser.parseString(xml, (err, feed) => {
  if (err) throw err;
  console.log(feed.title);
});
```

### Migration from `rss-parser`

Most existing code should keep working:

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

## Use as a CLI

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

## Use as an MCP tool server

```bash
npx agentic-rss-mcp --feed https://news.ycombinator.com/rss
```

This project currently ships a lightweight JSON-over-stdio compatible runner. If you want a full MCP protocol implementation, that can be added in a follow-up release without changing the public package surface.

## Development

```bash
npm install
npm test
```

## Contributing

Please read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a pull request.

## Roadmap

- pluggable LLM analyzers
- official MCP protocol transport
- OPML import/export
- feed health monitoring
- webhook and queue integrations
