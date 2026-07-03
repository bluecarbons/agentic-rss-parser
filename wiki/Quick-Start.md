# Quick Start

## 1. Parse a feed with the compat API (rss-parser drop-in)

```js
import { createParser } from 'agentic-rss-parser';

const parser = createParser();

// Returns a flat Array<{ item, analysis }>
// Also available as parser.feedErrors after the call
const results = await parser.parseFeed('https://hnrss.org/frontpage');

for (const { item, analysis } of results) {
  if (analysis.decision === 'relevant') {
    console.log(`[${analysis.confidence}%] ${item.title}`);
    console.log('  Tags:', analysis.tags.join(', '));
    console.log('  Action items:', analysis.actionItems);
  }
}

// Surface any per-feed errors
if (results.feedErrors?.length) {
  console.warn('Feed errors:', results.feedErrors);
}
```

## 2. Low-level pipeline with `runAgenticParser`

```js
import { runAgenticParser, createMemoryStorage } from 'agentic-rss-parser';

const { results, feedErrors } = await runAgenticParser({
  feedUrls: [
    'https://hnrss.org/frontpage',
    'https://blog.nodejs.org/en/feed'
  ],
  storage: createMemoryStorage(),   // no filesystem needed
  concurrency: 2,                   // fetch both feeds in parallel
  maxItems: 20                      // stop after 20 items are stored
});

console.log(`Processed ${results.length} items`);
if (feedErrors.length) console.warn(feedErrors);
```

## 3. Use an LLM provider

```js
import { createParser } from 'agentic-rss-parser';

const parser = createParser();
const results = await parser.parseFeed('https://hnrss.org/frontpage', {
  model: {
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4o-mini'
  }
});
```

Supported providers: `heuristic` (default, no key), `openai`, `anthropic`, `local` (Ollama or any OpenAI-compatible endpoint).

## 4. Custom heuristic signals

```js
const parser = createParser();
const results = await parser.parseFeed('https://example.com/feed', {
  model: {
    provider: 'heuristic',
    extraSignals: ['kubernetes', 'devops', 'cicd'],  // appended to defaults
    threshold: 2  // match 2 signals to be "relevant" (default: 3)
  }
});
```

## 5. Bring your own analyzer

```js
const results = await parser.parseFeed('https://example.com/feed', {
  analyzer: async ({ item, context }) => ({
    decision: item.title.includes('urgent') ? 'relevant' : 'ignore',
    confidence: 90,
    summary: item.title,
    impact: 'TBD',
    actionItems: [],
    tags: []
  })
});
```

## 6. Fetch full article body for richer LLM context

```js
const results = await parser.parseFeed('https://example.com/feed', {
  fetchFullArticle: true,  // fetches and strips HTML from item.link
  model: { provider: 'openai', apiKey: process.env.OPENAI_API_KEY }
});
```
