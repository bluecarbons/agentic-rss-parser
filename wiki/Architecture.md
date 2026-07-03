# Architecture

## Module Map

```
agentic-rss-parser/
├── src/
│   ├── index.js              Public entry point — re-exports everything
│   ├── index.d.ts            TypeScript declarations
│   ├── compat.js             ParserCompat / createParser — rss-parser-compatible API
│   ├── parser.js             runAgenticParser — core pipeline
│   ├── agent.js              heuristicAnalyze, analyzeFeedItem, resolveSignals
│   ├── storage.js            createStorage (SQLite) + createMemoryStorage
│   ├── fetch-article.js      fetchFullArticle — fetches + strips HTML
│   ├── tools.js              Alias → re-exports index.js (backward compat)
│   ├── cli.js                agentic-rss CLI entry point
│   ├── core/
│   │   ├── parser.js         parseXml, parseFeedXml, stripHtml
│   │   ├── http.js           fetchTextWithRedirects, assertHttpUrl
│   │   └── db-path.js        DEFAULT_DB_PATH — single source of truth
│   ├── adapters/
│   │   └── provider.js       createAnalyzer — dispatches to heuristic/openai/anthropic/local
│   └── mcp/
│       └── server.js         JSON-RPC MCP server (stdio transport)
└── test/
    ├── parser-compat.test.js
    ├── xml-parser.test.js
    ├── strip-html.test.js
    ├── storage-memory.test.js
    ├── concurrency.test.js
    ├── heuristic.test.js
    └── fixtures/
```

## Data Flow

```
Caller
  │
  ├─ createParser().parseFeed(urls, config)
  │     │
  │     └─▶ runAgenticParser(config)
  │               │
  │               ├─▶ fetchTextWithRedirects(feedUrl)   ← HTTP with redirect follow
  │               │         │
  │               │         └─▶ parseFeedXml(xml)        ← pure XML → JS object
  │               │                   │
  │               │                   └─▶ parseXml()     ← hand-rolled, quote-aware
  │               │
  │               ├─▶ normalizeItem(feedUrl, item)       ← stable SHA-256 ID
  │               │
  │               ├─▶ storage.hasProcessed(id)           ← dedup check
  │               │
  │               ├─▶ analyzeFeedItem(item, options)
  │               │         │
  │               │         ├─▶ fetchFullArticle(link)   ← optional HTML strip
  │               │         └─▶ analyzer({ item, ctx })  ← heuristic or LLM
  │               │
  │               ├─▶ storage.markProcessed(item)
  │               └─▶ storage.saveAnalysis(id, analysis)
  │
  └─▶ { results, feedErrors }
```

## Key Design Decisions

### Stable Item IDs
Each feed item is identified by `sha256(feedUrl + ":" + (link || guid || title || pubDate || ""))`. This gives deterministic, collision-resistant IDs without a database sequence, so the same article fetched from two different runs produces the same hash and is deduplicated correctly.

### Iterator-based concurrency
`mapWithConcurrency` uses a shared ES iterator instead of a shared mutable index. Each worker drains from the same iterator, so concurrency slots are never idle while work remains and the implementation is inherently race-free within a single thread.

### Pluggable StorageAdapter
The `StorageAdapter` interface is duck-typed — any object with `hasProcessed`, `markProcessed`, `saveAnalysis`, `getAnalyses`, `pruneOlderThan`, and `close` methods works. This decouples the pipeline from Node version constraints (Node 18/20 can use `createMemoryStorage()` while Node 22.5+ uses `createStorage()`).

### MCP Throttling
The MCP server wraps all `tools/call` dispatch in an in-process semaphore (`enqueueToolCall`). Concurrent tool invocations beyond the limit (default: 3, configurable via `AGENTIC_RSS_MAX_CONCURRENCY`) queue rather than pile up, preventing runaway memory and connection exhaustion when an LLM calls the tool repeatedly in parallel.

### Security Layers
- **Provider allowlist** — MCP callers cannot inject arbitrary provider strings.
- **Prompt sanitization** — `sanitizeForPrompt()` strips control characters and collapses newlines before interpolating untrusted feed content into LLM prompts.
- **Signal sanitization** — `sanitizeSignal()` restricts heuristic signal strings to `[a-z0-9\-_\s]`.
- **URL validation** — `assertHttpUrl()` rejects non-HTTP(S) URLs before any network call.
- **Response size cap** — LLM responses over 1 MB are rejected before `JSON.parse`.
