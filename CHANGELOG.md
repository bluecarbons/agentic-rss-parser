# Changelog

All notable changes to this project will be documented in this file.
This project adheres to [Semantic Versioning](https://semver.org/).

--- 

## [1.3.2] — 2026-06-27

### Fixed

- Anthropic response parsing now tolerates fenced JSON output.
- Security docs now clarify the deployment boundary for untrusted URLs and the default heuristic threshold behavior.

## [1.3.1] — 2026-06-27

### Fixed

- Removed example files from the npm tarball to reduce bundle-analysis noise and keep the published package focused on runtime code.

## [1.3.0] — 2026-06-27

### Security

- **SSRF prevention via private IP block** (`src/core/http.js`) — `assertHttpUrl()` now rejects requests to RFC-1918 private ranges (10.x, 172.16–31.x, 192.168.x), loopback (127.x, localhost, ::1), link-local / AWS metadata (169.254.x), carrier-grade NAT (100.64–127.x), and IPv6 ULA ranges (fc00::/7, fd00::/8). Previously only the URL scheme was validated, leaving redirect-based SSRF possible (e.g. a crafted feed redirecting to `http://169.254.169.254/latest/meta-data`).
- **Signal output sanitization** (`src/agent.js`) — `resolveSignals()` now strips non-alphanumeric characters (except hyphens, underscores, spaces) from user-supplied signal strings before they reach the `tags` output array and SQLite storage. Previously strings like `<script>` or `DROP TABLE` passed through as-is.
- **Unified XSS stripping in `fetch-article.js`** — `fetchFullArticle()` now strips `<iframe>`, `<object>`, `<embed>`, and `<form>` blocks in addition to `<script>` and `<style>`. Previously these tags were left intact, posing an XSS risk if article text was rendered as HTML downstream. The stripping now matches `core/parser.js` exactly.

### Added

- **Retry with exponential backoff** (`src/core/http.js`) — `fetchTextWithRedirects()` now retries automatically on 429 Too Many Requests and 5xx transient errors (up to 2 retries by default, configurable via `options.retries`). Respects the `Retry-After` response header when present. Network-level errors (DNS failure, connection reset, timeout) are also retried.
- **ETag / If-Modified-Since conditional GET support** (`src/core/http.js`) — `fetchTextWithRedirects()` now accepts `options.etag` and `options.lastModified` and sends `If-None-Match` / `If-Modified-Since` request headers. Returns `null` on a `304 Not Modified` response so callers can skip re-processing unchanged feeds. The return type is now `{ text, etag, lastModified } | null` (previously `string`).
- **Storage read API** (`src/storage.js`) — `createStorage()` now exposes two new methods:
  - `getAnalyses(opts?)` — query stored analyses with optional `feedUrl`, `decision`, `limit`, and `offset` filters. Returns joined rows from `analyses` + `processed_items` with JSON fields parsed.
  - `pruneOlderThan(ttlDays)` — delete processed items and analyses older than N days. Returns `{ deletedItems, deletedAnalyses }` counts. Prevents unbounded SQLite growth in long-running deployments.
- **LangChain.js integration example** (`examples/langchain-js.mjs`) — `DynamicStructuredTool` wrappers for `fetch_rss_feed` and `fetch_full_article`, wired into a `createToolCallingAgent` with `ChatAnthropic`. Completes SDK coverage alongside the existing ADK, Anthropic SDK, OpenAI Agents SDK, and Vercel AI SDK examples.
- **Examples shipped in npm tarball** — `examples/` added to `package.json` `files[]`. Previously examples were only available on GitHub; npm install users had no visibility into the SDK integration patterns.

### Fixed

- **MCP server `DEFAULT_DB_PATH`** (`src/mcp/server.js`) — the database now resolves using the same two-tier CWD strategy as `compat.js`: `process.cwd()/data/rss-agent.db` when installed as a package, falling back to the package root when running from a repo clone. Previously the MCP server used a module-relative path that resolved inside `node_modules` when installed.
- **Default Anthropic model** (`src/adapters/provider.js`, `examples/anthropic-sdk.mjs`, `examples/vercel-ai-sdk.mjs`) — updated from `claude-sonnet-4-5` to `claude-sonnet-4-6`.

### Breaking

- `fetchTextWithRedirects()` return type changed from `Promise<string>` to `Promise<{ text: string, etag: string|null, lastModified: string|null } | null>`. Internal callers (`parser.js`, `compat.js`, `fetch-article.js`) have been updated. External callers who imported this function directly will need to destructure `result.text` and handle the `null` (304) case.



### Fixed

- Security and SDK docs now describe the intentional networked runtime more accurately.

## [1.2.5] — 2026-06-27

### Fixed

- Security documentation now reflects the package's intentional dependency surface and explicit network access model.

## [1.2.4] — 2026-06-27

### Fixed

- GitHub Actions pack verification now uses a supported dry-run command.

## [1.2.3] — 2026-06-27

### Fixed

- GitHub Actions now installs pnpm explicitly before running install, lint, test, audit, and pack steps.

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
