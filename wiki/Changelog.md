# Changelog

All notable changes are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/).

---

## [1.4.0] — 2026-07-03

### Added
- `runAgenticParser` now accepts `config.maxItems` — stops processing after N items are stored, fixing the MCP `limit` dedup bug (#7)
- `parseFeed()` now surfaces `feedErrors` via `console.warn` and `results.feedErrors` (#6)
- MCP server in-process semaphore (`enqueueToolCall`) with `AGENTIC_RSS_MAX_CONCURRENCY` env var support, default concurrency 3 (#8)
- `createMemoryStorage().markProcessed()` now honours `item.processedAt` for backfill / migration / deterministic tests
- New `src/core/db-path.js` module — single source of truth for `DEFAULT_DB_PATH` resolution (#9)
- `attrRegex` in `parseXml` extended to handle unquoted attribute values and boolean flag attributes (#10)
- `src/tools.js` now re-exports everything from `src/index.js` — no longer a partial stub (#11)
- `src/core/db-path.js` added to lint script

### Fixed
- Flaky `pruneOlderThan` test replaced with deterministic `processedAt` backdate pattern
- Three `pruneOlderThan` boundary tests added (old only, recent only, mixed)
- `stripHtml` JSDoc rewritten to document both removal passes and `<form>` block removal

---

## [1.3.6] — prior

### Added
- `createMemoryStorage()` — pluggable in-memory `StorageAdapter` for Node 18/20 and tests (#4)
- Iterator-based `mapWithConcurrency` replacing shared-index pattern (#5)
- 26-test adversarial XML and `stripHtml` test suite (#3)
- `config.storage` parameter on `runAgenticParser` — supply your own `StorageAdapter`
- `feedErrors` returned from `runAgenticParser` (was silent before)
- Stable SHA-256 item IDs (was `crypto.randomUUID()` fallback — defeated deduplication)
- `ParserCompat.parseFile()` for local filesystem XML
- Heuristic confidence polarity fix — `ignore` items now scale confidence downward
- Prompt injection mitigation in `provider.js` (`sanitizeForPrompt`, control-char stripping)
- LLM response body size cap (1 MB)
- `assertHttpUrl()` in `core/http.js` — rejects non-HTTP URLs before network calls
- MCP server `provider` allowlist security guard
- `DEFAULT_DB_PATH` two-tier resolution strategy

### Fixed
- `contentSnippet` double-assignment clobbering in `normalizeItem`
- `isoDate` raw string passthrough replaced with `safeIsoDate()` (ISO 8601 or null)
- `fetchFullArticle` fetch trigger: `item.contentSnippet?.trim()` check instead of falsy check
- Empty `choices` / `content` array guards for OpenAI and Anthropic responses
- Anthropic JSON parse wrapped in try/catch with descriptive error
