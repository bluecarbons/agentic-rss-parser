# API Reference

All exports are available from the main entry point:

```js
import { ... } from 'agentic-rss-parser';
```

---

## `createParser(options?)`

Returns a `ParserCompat` instance — drop-in replacement for `rss-parser`.

```ts
createParser(options?: ParserOptions): Parser
```

**`ParserOptions`**

| Field | Type | Default | Description |
|---|---|---|---|
| `normalize` | `boolean` | `true` | Normalize field names |
| `customFields.feed` | `Array` | `[]` | Extra feed-level fields to extract |
| `customFields.item` | `Array` | `[]` | Extra item-level fields to extract |
| `headers` | `Record<string,string>` | — | Extra HTTP request headers |
| `timeout` | `number` | `10000` | HTTP timeout in ms |
| `maxRedirects` | `number` | `5` | Max HTTP redirects to follow |

---

## `Parser` instance methods

### `parser.parseFeed(urls, config?)`

Full agentic pipeline — fetch, parse, deduplicate, analyse.

```ts
parseFeed(urls: string | string[], config?: ParseFeedConfig): Promise<FeedResultsArray>
```

**`ParseFeedConfig`**

| Field | Type | Default | Description |
|---|---|---|---|
| `dbPath` | `string` | `cwd/data/rss-agent.db` | SQLite DB path |
| `storage` | `StorageAdapter` | — | Custom adapter (overrides `dbPath`) |
| `fetchFullArticle` | `boolean` | `false` | Fetch + strip full article HTML |
| `concurrency` | `number` | `1` | Max parallel feed fetches (max 16) |
| `maxItems` | `number` | — | Stop after N items are stored |
| `analyzer` | `Function` | — | Custom analyzer `({ item, context }) => AnalysisResult` |
| `model` | `AnalyzerConfig` | — | Provider config for built-in LLM adapters |

**Returns** `FeedResultsArray` — an `Array<{ item, analysis }>` with an extra `.feedErrors` property.

### `parser.parseURL(url, callback?)`
Fetch a URL and return a raw parsed feed object (no analysis). Supports callback style.

### `parser.parseString(xml, callback?)`
Parse raw XML string into a feed object. Synchronous internally.

### `parser.parseFile(path, callback?)`
Read a local file and parse as feed XML.

---

## `runAgenticParser(config)`

Low-level pipeline. Returns `{ results, feedErrors }` directly.

```ts
runAgenticParser(config: AgenticParserConfig): Promise<AgenticParserResult>
```

**`AgenticParserConfig`**

| Field | Type | Required | Description |
|---|---|---|---|
| `feedUrls` | `string[]` | ✅ | Feed URLs to process |
| `dbPath` | `string` | ✅ (or `storage`) | SQLite DB path |
| `storage` | `StorageAdapter` | — | Custom adapter (overrides `dbPath`) |
| `fetchFullArticle` | `boolean` | — | Fetch full article body |
| `concurrency` | `number` | — | Max parallel feed fetches |
| `maxItems` | `number` | — | Stop after N items stored |
| `parserOptions` | `ParserOptions` | — | Options forwarded to XML parser |
| `analyzer` | `Function` | — | Custom analyzer function |
| `model` | `AnalyzerConfig` | — | Built-in provider config |

**Returns**
```ts
{
  results: Array<{ item: NormalizedItem, analysis: AnalysisResult }>,
  feedErrors: Array<{ feedUrl: string, error: string }>
}
```

---

## `analyzeFeedItem(item, options?)`

Analyse a single feed item. Used internally but exported for custom pipelines.

```ts
analyzeFeedItem(item, options?: {
  fetchFullArticle?: boolean;
  analyzer?: Function;
  signals?: string[];
  extraSignals?: string[];
  threshold?: number;
}): Promise<AnalysisResult>
```

---

## `heuristicAnalyze(item, context?, options?)`

Synchronous heuristic scorer. No LLM, no async.

```ts
heuristicAnalyze(item, context?: string, options?: {
  signals?: string[];
  extraSignals?: string[];
  threshold?: number;   // default: 3
}): AnalysisResult
```

---

## `createStorage(dbPath)`

Create a SQLite-backed `StorageAdapter`. Requires Node ≥ 22.5.0.

```ts
createStorage(dbPath: string): StorageAdapter
```

---

## `createMemoryStorage()`

Create an in-memory `StorageAdapter`. Data is lost when the process exits. Works on any Node version.

```ts
createMemoryStorage(): StorageAdapter
```

---

## `createAnalyzer(config?)`

Build an analyzer function for use in `runAgenticParser({ analyzer })`.

```ts
createAnalyzer(config?: AnalyzerConfig): Promise<AnalyzerFn>
```

**`AnalyzerConfig`**

| Field | Type | Default | Description |
|---|---|---|---|
| `provider` | `'heuristic'\|'openai'\|'anthropic'\|'local'` | `'heuristic'` | Analysis backend |
| `model` | `string` | provider default | Model ID string |
| `apiKey` | `string` | — | API key (required for openai/anthropic) |
| `baseURL` | `string` | — | Override endpoint URL |
| `signals` | `string[]` | — | Replace default heuristic signals |
| `extraSignals` | `string[]` | — | Append to default signals |
| `threshold` | `number` | `3` | Min signal matches to mark relevant |

---

## `fetchFullArticle(url)`

Fetch a URL and return its plain-text content (HTML stripped).

```ts
fetchFullArticle(url: string): Promise<string>
```

---

## `resolveSignals(options?)`

Resolve the effective signal list given `signals` / `extraSignals` options.

```ts
resolveSignals(options?: { signals?: string[]; extraSignals?: string[] }): string[]
```

---

## `DEFAULT_HEURISTIC_SIGNALS`

The built-in signal array used by the heuristic provider:

```js
['release', 'security', 'vulnerability', 'node', 'javascript', 'typescript',
 'framework', 'api', 'breaking', 'performance', 'agent', 'rss']
```

---

## `AnalysisResult` shape

```ts
{
  decision: 'relevant' | 'ignore';
  confidence: number;        // 0–100
  summary: string;
  impact: string;
  actionItems: string[];
  tags: string[];            // matched signals or LLM-assigned tags
}
```
