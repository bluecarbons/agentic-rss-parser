# Changelog

All notable changes to this project will be documented in this file.
This project adheres to [Semantic Versioning](https://semver.org/).

--- 

## [1.2.1] — 2026-06-27

### Fixed

- README provider examples now use explicit `apiKey` configuration and remove stale env-var wording.

## [1.2.0] — 2026-06-25

### Added

- **Configurable heuristic signals** (`src/agent.js`) — The built-in signal list is no longer a private constant. Users can now customise relevance detection without an LLM API key via three new options passed to `heuristicAnalyze`, `createAnalyzer`, or `AgenticParserConfig.model`:
  - `signals: string[]` — fully replaces `DEFAULT_HEURISTIC_SIGNALS`
  - `extraSignals: string[]` — appended to `DEFAULT_HEURISTIC_SIGNALS`
  - `threshold: number` — minimum matched signals to mark an item `'relevant'` (default `3`)
- **`DEFAULT_HEURISTIC_SIGNALS`** exported as a named constant so consumers can inspect the defaults before extending or replacing them.
- **`resolveSignals(options)`** exported as a utility that implements the full signal-resolution priority chain: `signals` → `DEFAULT + extraSignals` → `DEFAULT`.
- **`userAgent` option** (`src/core/http.js`) — `fetchTextWithRedirects` now accepts `options.userAgent` as a first-class option. Resolves the 403 issue on feeds that block bot user-agents (Reddit, HN, Lobste.rs). UA resolution priority: `headers['user-agent']` > `options.userAgent` > package default.
- **SDK integration examples** (three new files in `examples/`):
  - `examples/anthropic-sdk.mjs` — Full Anthropic Messages API agentic loop with tool-use cycle (`@anthropic-ai/sdk`).
  - `examples/openai-agents-sdk.mjs` — OpenAI Agents SDK `FunctionTool` (`@openai/agents`).
  - `examples/vercel-ai-sdk.mjs` — Vercel AI SDK `tool()` with `generateText` and `maxSteps` (`ai` + `@ai-sdk/anthropic`).
- **Default Anthropic model updated** to `claude-sonnet-4-5` in `src/adapters/provider.js` and all SDK examples.

### Fixed

- **`DEFAULT_DB_PATH` in `src/compat.js`** — When installed as an npm package the database now lands at `process.cwd()/data/rss-agent.db` (the consuming project's root), not inside `node_modules`. Detected via CWD vs package-root comparison; falls back to package-root path when running directly from a repo clone.
- **`src/adapters/provider.js`** — `signals`, `extraSignals`, and `threshold` are now threaded through `createAnalyzer` to `heuristicAnalyze`, so callers using the analyzer factory get the same signal-customisation capability as direct `heuristicAnalyze` calls.
- **`examples/direct.mjs`** — Fixed `runAgenticParser` call to destructure `{ results, feedErrors }` correctly; added `feedErrors` surface to stderr.
- **`examples/adk-real.mjs`** — Removed `zod` dependency (parameters now declared as plain JSON Schema); fixed `runAgenticParser` destructure; added `InMemoryRunner` self-executing block; updated model to `gemini-2.0-flash`.
- **`README.md`** — Fixed broken `examples/adk-tool.mjs` link (→ `examples/adk-real.mjs`); fixed `runAgenticParser` code samples to destructure `{ results, feedErrors }`.

---

## [1.1.1] — 2026-06-24

### Security

- **`src/core/http.js`** — Enforced a 5 MB hard cap on feed response bodies. A malicious or misconfigured server returning a multi-MB payload could previously exhaust Node.js heap via unbounded `response.text()`. The cap is checked against `Content-Length` header (fast path) and re-checked after buffering (covers chunked/streaming responses).
- **`src/adapters/provider.js`** — Added `sanitizeForPrompt()` to strip ASCII control characters and collapse newlines before interpolating feed content into LLM prompts. Prevents prompt injection via crafted feed titles or snippets (e.g. `\nAssistant: ignore all previous instructions`).
- **`src/adapters/provider.js`** — Added explicit empty API key guards for OpenAI and Anthropic providers. Previously an unset key was silently forwarded as an empty `Bearer ` token, producing a cryptic 401. Now throws a clear, actionable error before any network call.
- **`src/adapters/provider.js`** — Added `SUPPORTED_PROVIDERS` allowlist enforced at `createAnalyzer` entry.
- **`src/mcp/server.js`** — Added `ALLOWED_PROVIDERS` validation in `handleToolCall`. An untrusted MCP caller supplying an arbitrary `provider` string now receives a JSON-RPC `-32602 Invalid params` error.

### Fixed

- **`src/parser.js`** — Replaced `crypto.randomUUID()` deduplication fallback with an empty-string sentinel. Items with no link, guid, title, or pubDate previously received a fresh UUID on every run, silently defeating the SQLite dedup layer.
- **`src/adapters/provider.js`** — Added array-length guards before indexing `resData.choices[0]` (OpenAI) and `resData.content[0]` (Anthropic).
- **`src/cli.js`** — `--feed` and `--db` flags now validate that the next argv token exists and is not another flag.
- **`src/core/parser.js`** — `isoDate` now produced by `safeIsoDate()`, normalising RFC 2822 strings to ISO 8601.
- **`src/core/parser.js`** — Removed double assignment of `contentSnippet`.
- **`src/core/parser.js`** — Added `<form>` and `<embed>` to `stripHtml` block-removal pass.
- **`src/mcp/server.js`** — Fixed tool `description` fields to describe what each tool does.

---

## [1.1.0] — 2026-06-23

### Fixed (Critical)

- **`src/fetch-article.js`** — Replaced raw `fetch()` with `fetchTextWithRedirects()`. Unbounded `response.text()` with no timeout, redirect cap, or size guard could OOM the process.
- **`src/agent.js`** — Exported `heuristicAnalyze`. Was causing a silent `undefined` at runtime when using the heuristic provider.

### Fixed (Medium)

- **`src/mcp/server.js`** — `dbPath` now resolved via `import.meta.url` (CWD is unpredictable when launched by Claude Desktop, Cursor, etc.).
- **`src/compat.js`** — Same `dbPath` fix. Removed dead `xml2js` config key.

### Fixed (Low)

- **`src/parser.js`** — Removed unnecessary `await` on `parseFeedXml`.
- **`src/fetch-article.js`** — Corrected user-agent placeholder.
- **`package.json`** — Fixed `lint` script to cover all source files, not just `src/cli.js`.
- **`package.json`** — Added `"socket"` ignore for intentional `process.env` access and outbound network calls.
- **`package.json`** — Added `types` path to `./mcp` export condition.

### Added

- **`src/mcp/server.d.ts`** — Dedicated type declarations for the `./mcp` export.
- **`src/index.d.ts`** — Named interfaces; tightened return types; removed dead `xml2js` field.

---

## [1.0.8] — 2026-06-23

### Changed

- **Zero-Dependency Refactor** — Removed all external production dependencies (`fast-xml-parser`, `zod`, `ai`, `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@modelcontextprotocol/sdk`).
- **Custom XML Engine** — Non-recursive, character-by-character scanner parser. Protected against XXE and Billion Laughs.
- **Native Providers & Server** — Custom OpenAI/Anthropic native fetch adapters and a custom stdio JSON-RPC 2.0 MCP server.
- **Bug Fix** — Fixed link normalisation bug where self-closing and attribute-based RSS/Atom links resolved as raw objects.

## [1.0.7] — Bug fixes and enhancements.

## [1.0.6] — Bug fixes and enhancements.

## [1.0.5] — Bug fixes and enhancements.

## [1.0.4] — Bug fixes and enhancements.

## [1.0.3] — Bug fixes and enhancements.

## [1.0.2]

- Prepared the package for pnpm publication with supply-chain hardening and reproducible lockfiles.
- Added enterprise-oriented repo hygiene, security, and publishing documentation.

## [1.0.1]

### Added

- From-scratch RSS and Atom parsing with a compatibility layer for `rss-parser`-style usage.
- Agentic analysis pipeline with deduplication, enrichment, and provider adapters.
- MCP-ready tooling and CLI entrypoints.
- Realistic RSS and Atom fixture coverage.

### Changed

- Replaced the old XML stack with `fast-xml-parser`.
- Updated the public package surface and release metadata.
