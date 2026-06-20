# Agentic RSS Parser v1.0.1

## Summary

Agentic RSS Parser v1.0.1 is a from-scratch Node.js RSS and Atom parser built on `fast-xml-parser`. It keeps a migration-friendly `Parser` API for `rss-parser`-style code while adding agentic workflows for deduplication, enrichment, and provider-backed analysis.

## What’s New

- from-scratch parser implementation with no dependency on the deprecated `rss-parser` package
- `Parser` compatibility layer with `parseURL`, `parseString`, and `parseFile`
- explicit redirect handling with `maxRedirects`, timeout support, and URL protocol validation
- RSS 2.0 and Atom fixture coverage
- agentic pipeline with SQLite-backed deduplication and structured analysis
- OpenAI-compatible and Anthropic-compatible model adapters
- CLI and MCP entrypoints for agent-friendly integrations

## Upgrade Notes

If you are migrating from `rss-parser`, update your import to:

```js
import Parser from 'agentic-rss-parser';
```

The supported compatibility surface includes:

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

## Agentic Features

The agentic workflow is designed for higher-level automation:

- dedupe items by stable IDs
- enrich short summaries with full article text
- classify feeds via pluggable model providers
- persist processed state in SQLite
- emit structured analysis objects for downstream routing

## Validation

- `npm test`
- `npm audit`

## Notes

- This release keeps the API conservative so existing feed consumers can migrate with minimal changes.
- The compatibility layer normalizes output into familiar feed and item objects while preserving the agentic feature set.
