# Configuration

## Provider selection

The `model` / `AnalyzerConfig` object controls which analysis backend is used.

```js
// No config needed — heuristic works offline
await parser.parseFeed(url);

// OpenAI
await parser.parseFeed(url, {
  model: { provider: 'openai', apiKey: process.env.OPENAI_API_KEY, model: 'gpt-4o-mini' }
});

// Anthropic
await parser.parseFeed(url, {
  model: { provider: 'anthropic', apiKey: process.env.ANTHROPIC_API_KEY, model: 'claude-sonnet-4-6' }
});

// Local Ollama (OpenAI-compatible)
await parser.parseFeed(url, {
  model: { provider: 'local', baseURL: 'http://localhost:11434/v1', model: 'llama3' }
});
```

## Heuristic tuning

```js
// Replace default signals entirely
await parser.parseFeed(url, {
  model: {
    provider: 'heuristic',
    signals: ['kubernetes', 'docker', 'helm', 'operator']
  }
});

// Append to defaults
await parser.parseFeed(url, {
  model: {
    provider: 'heuristic',
    extraSignals: ['funding', 'acquisition', 'layoff'],
    threshold: 2   // default is 3
  }
});
```

The `threshold` is the minimum number of signal matches for a `'relevant'` decision. Lower it to be more inclusive, raise it to reduce noise.

## Concurrency

```js
await runAgenticParser({
  feedUrls: ['url1', 'url2', 'url3', 'url4'],
  concurrency: 4,   // fetch all four feeds simultaneously (max 16)
  storage: createMemoryStorage(),
  dbPath: undefined
});
```

## Item limit

`maxItems` stops processing after N items have been **stored** (not just fetched). This is the correct way to limit MCP tool output — it prevents already-seen items from burning through a large feed on every call:

```js
await runAgenticParser({
  feedUrls: [url],
  maxItems: 5,     // stop after 5 new items are analysed and stored
  storage,
  dbPath: undefined
});
```

## HTTP options

Set via `ParserOptions` on the `createParser()` constructor:

```js
const parser = createParser({
  timeout: 5000,        // 5 s per feed fetch (default: 10 000)
  maxRedirects: 3,      // follow up to 3 redirects (default: 5)
  headers: {
    'User-Agent': 'MyBot/1.0'
  }
});
```

## Custom fields

Extract non-standard feed fields using the `customFields` option:

```js
const parser = createParser({
  customFields: {
    feed: ['language', 'copyright'],
    item: [
      ['media:content', 'mediaContent'],           // rename
      ['dc:creator', 'author'],                    // rename
      ['content:encoded', 'fullContent', { includeSnippet: true }]  // rename + strip
    ]
  }
});
```

## Environment variables (MCP server)

| Variable | Default | Description |
|---|---|---|
| `AGENTIC_RSS_MAX_CONCURRENCY` | `3` | Max simultaneous MCP tool calls |

## DB path

The default DB path follows a two-tier strategy:

1. `<cwd>/data/rss-agent.db` — when running inside a consumer project
2. `<package-root>/data/rss-agent.db` — when running directly from a repo clone

Override it:
```js
await parser.parseFeed(url, { dbPath: '/var/lib/myapp/rss.db' });
```
