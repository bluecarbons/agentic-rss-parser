# Agentic RSS Parser v1.0.1

Agentic RSS Parser v1.0.1 is a from-scratch RSS and Atom parser for Node.js built on `fast-xml-parser`. It preserves a familiar `rss-parser`-style API for migration while adding agentic workflows for deduplication, enrichment, and provider-backed analysis.

## Highlights

- from-scratch parser implementation, no dependency on the deprecated `rss-parser` package
- `Parser` compatibility layer with `parseURL`, `parseString`, and `parseFile`
- `maxRedirects`, `timeout`, headers, and request option support with explicit redirect handling
- RSS 2.0 and Atom fixture coverage
- agentic pipeline with SQLite-backed deduplication and structured analysis
- OpenAI-compatible and Anthropic-compatible model adapters
- MCP entrypoint and CLI support

## Breaking Changes

- none intended for the documented compatibility surface
- package internals were reworked to remove the deprecated parser dependency

## Upgrade Notes

If you were previously using `rss-parser`, update your import to:

```js
import Parser from 'agentic-rss-parser';
```

Existing `parseURL`, `parseString`, and `parseFile` flows should continue to work for the supported compatibility surface.

## Validation

- `npm test`
- `npm audit`
