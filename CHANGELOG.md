# Changelog

## 1.0.8

### Changed
- **Zero-Dependency Refactor**: Removed all external production dependencies (`fast-xml-parser`, `zod`, `ai`, `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@modelcontextprotocol/sdk`).
- **Custom XML Engine**: Integrated a secure, non-recursive, character-by-character scanner parser. Protected against XXE and Billion Laughs.
- **Native Providers & Server**: Built custom OpenAI/Anthropic native fetch adapters and a custom stdio JSON-RPC MCP server.
- **Bug Fix**: Fixed a link normalization bug where self-closing and attribute-based RSS/Atom links were resolved as raw objects rather than strings when using default options.

## 1.0.7

- Bugs fixes and enhancements.

## 1.0.6

- Bugs fixes and enhancements.

## 1.0.4

- Bugs fixes and enhancements.

## 1.0.5

- Bugs fixes and enhancements.

## 1.0.3

- Bugs fixes and enhancements.

## 1.0.2

### Changed

- prepared the package for pnpm publication with supply-chain hardening and reproducible lockfiles
- added enterprise-oriented repo hygiene, security, and publishing documentation

### Notes

- no runtime API changes intended

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
