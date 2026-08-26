# Changelog

All notable changes to this project will be documented in this file.
This project adheres to [Semantic Versioning](https://semver.org/).

---

## [1.7.2] — 2026-08-26

### Added & Optimized

- **First-Class Subpath Exports & Zero-Cost Tree-Shaking** (`package.json`) — Added dedicated subpath entry points (`agentic-rss-parser/core`, `/json`, `/opml`, `/agent`, `/storage`, `/watcher`, `/mcp`) paired with granular TypeScript `.d.ts` declaration maps.
- **Edge & Serverless Runtime Readiness** — The core XML, Atom, OPML, and JSON Feed parsers can now be imported independently without loading Node.js native bindings (`node:sqlite`, `node:fs`), providing zero-dependency execution in Cloudflare Workers, Next.js Edge, Bun, Deno, and Browser environments.
- **Safe MCP Server Stdio Initialization** (`src/mcp/server.js`) — Encapsulated the stdio `readline` interface inside `startServer()`, ensuring importing MCP tool and resource definitions does not attach dangling background event loop listeners.

## [1.7.1] — 2026-08-25

### Security & Supply Chain Hardening

- **Eliminated `createRequire` Dynamic Require** (`src/storage.js`) — Switched to native ESM `import { DatabaseSync } from 'node:sqlite'` to eliminate `dynamicRequire` and obfuscated import heuristics flagged by Socket.dev.
- **Added Community Health & Compliance Manifests** — Added `CODE_OF_CONDUCT.md` (Contributor Covenant v2.1) and `CONTRIBUTING.md` to resolve packaging manifest mismatches.
- **Enhanced Module Purity & Tree-Shaking** (`package.json`) — Added `"sideEffects": false` to declare side-effect-free package loading.
- **Granular Subpath Exports for Tree-Shaking** (`package.json`) — Added first-class subpath entry points (`/core`, `/json`, `/opml`, `/agent`, `/storage`, `/watcher`, `/mcp`) with dedicated TypeScript typings, enabling zero-dead-code bundles for edge runtimes (Cloudflare Workers, Next.js Edge, Browsers).
- **Safe MCP Server Stdio Initialization** (`src/mcp/server.js`) — Encapsulated `readline` stdio interface in `startServer()` so importing tools/resources does not hang event loop listeners.

## [1.7.0] — 2026-08-23

### Security

- **MCP BaseURL Credential Exfiltration Guard** (`src/mcp/server.js`) — Environment API keys (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`) are no longer automatically forwarded if a custom or untrusted `baseURL` is specified in MCP tool arguments. Custom proxy endpoints now require explicitly passing `apiKey` to prevent unauthorized credential capture.
- **Prototype Pollution & Method Shadowing Fix** (`src/core/parser.js`) — `toJsObject()` now checks object keys with `Object.hasOwn(res, name)` rather than `name in res`, preventing accidental property collisions with `Object.prototype` methods (such as `toString` or `valueOf`). Sensitive keys (`__proto__`, `constructor`, `prototype`) are sanitized.
- **XML Entity Decoding DoS Prevention** (`src/core/parser.js`) — Added bounds checking (`0 <= codePoint <= 0x10FFFF`) before invoking `String.fromCodePoint()` in `unescapeEntities()` to prevent unhandled `RangeError` crashes when parsing invalid numeric entities.
- **XML Nesting Stack Overflow Guard** (`src/core/parser.js`) — Added a maximum nesting depth cap (`MAX_XML_DEPTH = 128`) in `parseXml()` to reject deeply nested XML bombs.
- **SSRF CIDR Blocklist Hardening** (`src/core/http.js`) — Added coverage for all remaining IANA special/reserved ranges, including multicast (`224.0.0.0/4`), reserved Class E (`240.0.0.0/4`), documentation (`192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24`, `2001:db8::/32`), benchmarking (`198.18.0.0/15`), 6to4 (`2002::/16`), and discard (`100::/64`) prefixes.

### Added

- **JSON Feed (v1 & v1.1) Support** (`src/core/json-feed.js`, `src/core/parser.js`) — Native detection and parsing for JSON Feed specification alongside RSS and Atom. Exported `isJsonFeed` and `parseJsonFeed`.
- **Podcast & Media RSS Enclosure Normalization** (`src/core/parser.js`) — Extracted `<enclosure>` audio/video metadata, `<media:thumbnail>`/`<media:content>` URLs, and iTunes podcast tags (`itunes:duration`, `itunes:episode`, `itunes:author`, `itunes:image`).
- **Persistent HTTP Caching (ETag / Last-Modified)** (`src/storage.js`, `src/parser.js`) — Added `feed_cache` table to SQLite and memory storage. `runAgenticParser` now automatically sends conditional GET headers and handles HTTP 304 Not Modified, eliminating unnecessary network bandwidth and redundant LLM analysis.
- **Database Search & Analytics APIs** (`src/storage.js`) — Added `storage.searchAnalyses(query, opts)` for keyword searching across stored articles and intelligence, and `storage.getStatistics()` for database metrics.
- **Custom Prompts and Schemas** (`src/adapters/provider.js`) — `createAnalyzer()` now accepts `systemPrompt` and `promptTemplate` (string with placeholder interpolation or custom function) for domain-specific evaluation workflows.
- **Expanded MCP Server Tools & Resources** (`src/mcp/server.js`) — Added `search_feed_history`, `get_feed_statistics`, and `prune_database` tools, plus the `rss://analyses/latest` MCP resource endpoint.

## [1.6.1] — 2026-07-30

### Fixed

- **`package.json`** — Added `urlStrings: true` to the `socket.ignore` block and verified clean zero-dependency tarball structure to suppress false-positive static analysis alerts on Socket.dev.
- **`README.md`** — Updated release banner callout to v1.6.1.

## [1.6.0] — 2026-07-30

### Added

- **`src/core/opml.js`** — Introduced zero-dependency `parseOpml(xmlString)` to parse OPML Outline XML files into structured feed lists with outline categories and URLs.
- **`src/watcher.js`** — Introduced `createFeedWatcher(config)` event emitter for continuous background feed polling, automatic conditional GET headers, and status event listeners (`result`, `poll`, `feedError`, `error`, `stop`).
- **`src/storage.js`** — Added `exportForEmbedding(opts?)` to SQLite `createStorage` and `createMemoryStorage` adapters to format stored items & analyses into vector-database-ready document payloads.
- **`src/parser.js`** — Updated `runAgenticParser` to accept a dynamic function resolver for `parserOptions` (`(feedUrl: string) => ParserOptions`), enabling custom per-feed User-Agents and header overrides.

## [1.5.0] — 2026-07-19

### Fixed

- **`src/core/parser.js`** — Fixed the unquoted-attribute regex truncating any value containing a `/`. This broke the single most common real-world unquoted attribute — a URL — e.g. `<link href=http://example.com/feed>` previously parsed as `href="http:"` plus two bogus boolean attributes (`com`, `feed`). The trailing self-close slash is already stripped before attribute parsing runs, so excluding `/` from the value charclass was unnecessary; unquoted values now stop only at whitespace, `>`, `"`, or `'`.
- **`src/mcp/server.js`** — `fetch_rss_feed`'s `provider` parameter previously had no way to receive credentials: only `{ provider }` was forwarded to `createAnalyzer`, so selecting `openai` or `anthropic` always failed with "API key is required." Added `apiKey` / `model` / `baseURL` tool arguments, with `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` environment-variable fallback when the argument is omitted.
- **`src/cli.js`** — Added `--provider`, `--api-key`, `--model`, and `--base-url` flags. Previously the CLI had no way to select an LLM provider at all; every invocation silently used the heuristic analyzer regardless of README claims about LLM analysis.
- **`src/parser.js`** — Fixed a `maxItems` race across concurrently-processed feeds: the cap check read `results.length`, which was only updated after each item's `await`-ing analysis/storage calls completed, so two feeds could both pass the check before either had pushed a result, letting the total slightly exceed `maxItems`. Replaced with a synchronously-reserved counter incremented in the same tick as the check.
- **`package.json`** — Removed the stale "Built on fast-xml-parser" description and matching keyword; the package has zero runtime dependencies and always used a hand-rolled parser.

### Security

- **DNS-rebinding gap in SSRF protection** (`src/core/http.js`) — `assertHttpUrl()` only ever inspected the literal hostname string, so a domain that *resolves* to a private/loopback address (rather than embedding one directly in the URL) was not blocked. Added `assertResolvedHostSafe()`, an async DNS-aware check called before the initial request and again after every redirect hop, which resolves the hostname and rejects the request if any returned address is private, loopback, link-local, or carrier-grade-NAT. Documented residual TOCTOU limitation: this check and the connection `fetch()` makes are not atomic, since fully pinning the connection to a validated IP is out of scope for a zero-dependency library built on the global `fetch`.
- **Missing IPv6 link-local range** (`src/core/http.js`) — the private-address check never covered `fe80::/10`; also added handling for IPv4-mapped IPv6 literals (`::ffff:a.b.c.d`), including Node's own compressed hex-group normalization of that form (`::ffff:7f00:1`).
- **Non-streaming size caps** (`src/core/http.js`, `src/adapters/provider.js`) — the 5 MB feed / 1 MB LLM-response caps were only checked against `content-length` (absent on chunked responses, or forgeable) and otherwise only *after* `response.text()` had already buffered the full body. Replaced with `readBodyWithCap()`, which counts bytes incrementally as the stream is read and aborts the connection the moment the cap is exceeded, regardless of any header claim.

## [1.3.6] — 2026-06-29

### Fixed

- **`src/core/parser.js`** — Added quote-aware `>` scanner (`findTagClose`) to prevent tag-string corruption when attribute values contain unescaped `>` characters (e.g. `title="A > B"`). Previously, a naive `indexOf('>')` would split the tag at the first `>` inside a quoted value, silently corrupting every subsequent sibling node.
- **`src/agent.js`** — Fixed inverted confidence formula for `ignore` decisions. Previously all ignored items received a fixed `confidence: 35` regardless of signal score. Now scales correctly: `relevant` → `Math.min(95, 35 + score * 10)`; `ignore` → `Math.max(5, 95 - score * 10)`.
- **`src/storage.js`** — Changed `link` column from `TEXT NOT NULL` to `TEXT` (nullable); `markProcessed` now passes `item.link || null` so link-less items store a proper `NULL` instead of an empty string.
- **`src/storage.js`** — `pruneOlderThan` now uses a parameterised binding for the interval string instead of string interpolation, eliminating static-analysis false positives.
- **`src/adapters/provider.js`** — Wrapped Anthropic `JSON.parse` in a `try/catch`; malformed or refused responses now surface as a descriptive `feedErrors` entry rather than a bare `SyntaxError`.
- **`src/mcp/server.js`** — `fetch_full_article` handler now calls `assertHttpUrl` early and returns a clean JSON-RPC `-32602 Invalid params` error on bad URLs instead of an opaque `-32603 Internal error` stack trace.

## [1.3.5] — 2026-06-28

### Fixed

- Bugs fixes and enhancements.

## [1.3.4] — 2026-06-27

### Fixed

- Bugs fixes and enhancements.

## [1.3.3] — 2026-06-27

### Fixed

- Bugs fixes and enhancements.

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
