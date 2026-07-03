# Storage Adapters

The `StorageAdapter` interface is duck-typed — any object implementing these six methods is accepted by `runAgenticParser({ storage: myAdapter })`.

## Interface

```ts
interface StorageAdapter {
  hasProcessed(id: string): boolean;
  markProcessed(item: {
    id: string; feedUrl: string; title: string;
    link: string; publishedAt?: string | null;
    processedAt?: string;   // ISO 8601 — optional backfill/migration timestamp
  }): void;
  saveAnalysis(itemId: string, analysis: {
    id: string; decision: string; confidence: number;
    summary: string; impact: string;
    actionItems: string[]; tags: string[];
  }): void;
  getAnalyses(opts?: GetAnalysesOptions): StorageAnalysisRow[];
  pruneOlderThan(ttlDays: number): { deletedItems: number; deletedAnalyses: number };
  close(): void;
}
```

---

## `createStorage(dbPath)` — SQLite (Node ≥ 22.5)

Backed by the built-in `node:sqlite` module. Data persists across runs.

```js
import { createStorage } from 'agentic-rss-parser';

const storage = createStorage('/var/lib/myapp/rss.db');
```

The schema is created automatically on first use (two tables: `processed_items`, `analyses`; two indexes).

**Pruning old records:**

```js
const { deletedItems, deletedAnalyses } = storage.pruneOlderThan(30); // 30-day TTL
```

---

## `createMemoryStorage()` — In-memory (any Node version)

Data stored in `Map` instances. Lost when the process exits. Ideal for:
- Unit and integration tests
- Node 18/20 environments
- Stateless / serverless deployments

```js
import { createMemoryStorage } from 'agentic-rss-parser';

const storage = createMemoryStorage();

// Backdate for migration / testing
storage.markProcessed({
  id: 'abc',
  feedUrl: 'https://example.com/feed',
  title: 'Old item',
  link: 'https://example.com/1',
  processedAt: '2024-01-01T00:00:00.000Z'  // honour past timestamp
});
```

---

## `getAnalyses(opts?)` — querying stored analyses

```js
const rows = storage.getAnalyses({
  feedUrl: 'https://example.com/feed',  // filter by feed
  decision: 'relevant',                 // 'relevant' | 'ignore'
  limit: 20,                            // default 50, max 1000
  offset: 0
});
```

Each returned row contains:
- `id`, `item_id`, `decision`, `confidence`, `summary`, `impact`
- `actionItems` (Array), `tags` (Array)
- `created_at`, `feed_url`, `title`, `link`, `published_at`, `processed_at`

---

## Writing a custom adapter

Any backend works. Example using `better-sqlite3` for Node 18/20:

```js
import Database from 'better-sqlite3';

function createBetterSqliteStorage(dbPath) {
  const db = new Database(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS processed_items (
      id TEXT PRIMARY KEY,
      feed_url TEXT, title TEXT, link TEXT,
      published_at TEXT, processed_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS analyses (
      id TEXT PRIMARY KEY, item_id TEXT,
      decision TEXT, confidence INTEGER,
      summary TEXT, impact TEXT,
      action_items TEXT, tags TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
  return {
    hasProcessed: (id) => Boolean(db.prepare('SELECT 1 FROM processed_items WHERE id=?').get(id)),
    markProcessed: (item) => db.prepare(
      'INSERT OR IGNORE INTO processed_items (id,feed_url,title,link,published_at) VALUES (?,?,?,?,?)'
    ).run(item.id, item.feedUrl, item.title, item.link, item.publishedAt),
    saveAnalysis: (itemId, a) => db.prepare(
      'INSERT OR IGNORE INTO analyses (id,item_id,decision,confidence,summary,impact,action_items,tags) VALUES (?,?,?,?,?,?,?,?)'
    ).run(a.id, itemId, a.decision, a.confidence, a.summary, a.impact, JSON.stringify(a.actionItems), JSON.stringify(a.tags)),
    getAnalyses: (opts = {}) => db.prepare('SELECT * FROM analyses LIMIT ? OFFSET ?').all(opts.limit ?? 50, opts.offset ?? 0),
    pruneOlderThan: (days) => {
      const cut = new Date(Date.now() - days * 86400000).toISOString();
      const da = db.prepare("DELETE FROM analyses WHERE item_id IN (SELECT id FROM processed_items WHERE processed_at < ?)").run(cut).changes;
      const di = db.prepare("DELETE FROM processed_items WHERE processed_at < ?").run(cut).changes;
      return { deletedItems: di, deletedAnalyses: da };
    },
    close: () => db.close()
  };
}

import { runAgenticParser } from 'agentic-rss-parser';

const { results } = await runAgenticParser({
  feedUrls: ['https://example.com/feed'],
  storage: createBetterSqliteStorage('./rss.db')
});
```
