# Changelog

## 1.0.1

### Added

- from-scratch RSS and Atom parsing with a compatibility layer for `rss-parser`-style usage
- agentic analysis pipeline with deduplication, enrichment, and provider adapters
- MCP-ready tooling and CLI entrypoints
- realistic RSS and Atom fixture coverage

### Changed

- replaced the old XML stack with `fast-xml-parser`
- updated the public package surface and release metadata

### Notes

- `parseURL()` and `parseString()` are supported for migration purposes
- `parseFeed()` exposes the agentic workflow for programmatic use
