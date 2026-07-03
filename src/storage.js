import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * StorageAdapter interface (duck-typed — no class required):
 *
 *   hasProcessed(id: string): boolean
 *   markProcessed(item: { id, feedUrl, title, link, publishedAt, processedAt? }): void
 *   saveAnalysis(itemId: string, analysis: { id, decision, confidence, summary, impact, actionItems, tags }): void
 *   getAnalyses(opts?: GetAnalysesOptions): StorageAnalysisRow[]
 *   pruneOlderThan(ttlDays: number): { deletedItems: number, deletedAnalyses: number }
 *   close(): void
 *
 * Pass a custom adapter to runAgenticParser({ storage: myAdapter }) to:
 *   - Use better-sqlite3 on Node 18/20 (no node:sqlite built-in)
 *   - Use an in-memory store for tests (createMemoryStorage)
 *   - Swap in any other persistence backend
 */

/**
 * Create a SQLite-backed storage adapter using Node's built-in node:sqlite.
 * Requires Node >= 22.5.0.
 *
 * @param {string} dbPath - Absolute path to the SQLite database file.
 * @returns {StorageAdapter}
 */
export function createStorage(dbPath) {
  // Lazy-import so that environments without node:sqlite (Node < 22.5) can
  // still import this module as long as they supply their own storage adapter
  // via runAgenticParser({ storage: ... }) and never call createStorage().
  let DatabaseSync;
  try {
    ({ DatabaseSync } = await_import_sync());
  } catch {
    throw new Error(
      'createStorage() requires Node >= 22.5.0 (node:sqlite built-in). ' +
      'On Node 18/20, supply a custom storage adapter via runAgenticParser({ storage: createMemoryStorage() }) ' +
      'or a better-sqlite3-based adapter. See README for details.'
    );
  }

  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS processed_items (
      id          TEXT PRIMARY KEY,
      feed_url    TEXT NOT NULL,
      title       TEXT NOT NULL,
      link        TEXT,
      published_at TEXT,
      processed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) STRICT;

    CREATE TABLE IF NOT EXISTS analyses (
      id          TEXT PRIMARY KEY,
      item_id     TEXT NOT NULL,
      decision    TEXT NOT NULL,
      confidence  INTEGER NOT NULL,
      summary     TEXT NOT NULL,
      impact      TEXT NOT NULL,
      action_items TEXT NOT NULL,
      tags        TEXT NOT NULL,
      created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) STRICT;

    -- Indexes for O(log n) lookups on common query paths.
    -- CREATE INDEX IF NOT EXISTS is idempotent on repeated cold starts.
    CREATE INDEX IF NOT EXISTS idx_processed_items_feed_url
      ON processed_items (feed_url);

    CREATE INDEX IF NOT EXISTS idx_analyses_item_id
      ON analyses (item_id);
  `);

  return {
    hasProcessed(id) {
      const row = db.prepare('SELECT 1 FROM processed_items WHERE id = ?').get(id);
      return Boolean(row);
    },

    markProcessed(item) {
      // processedAt is optional — when supplied (e.g. backfill / migration)
      // it is used instead of CURRENT_TIMESTAMP so the SQLite row reflects
      // the original ingest time rather than the current wall-clock time.
      if (item.processedAt) {
        db
          .prepare(
            'INSERT OR IGNORE INTO processed_items (id, feed_url, title, link, published_at, processed_at) VALUES (?, ?, ?, ?, ?, ?)'
          )
          .run(item.id, item.feedUrl, item.title, item.link || null, item.publishedAt ?? null, item.processedAt);
      } else {
        db
          .prepare(
            'INSERT OR IGNORE INTO processed_items (id, feed_url, title, link, published_at) VALUES (?, ?, ?, ?, ?)'
          )
          .run(item.id, item.feedUrl, item.title, item.link || null, item.publishedAt ?? null);
      }
    },

    saveAnalysis(itemId, analysis) {
      db
        .prepare(
          `INSERT OR IGNORE INTO analyses
           (id, item_id, decision, confidence, summary, impact, action_items, tags)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          analysis.id,
          itemId,
          analysis.decision,
          analysis.confidence,
          analysis.summary,
          analysis.impact,
          JSON.stringify(analysis.actionItems),
          JSON.stringify(analysis.tags)
        );
    },

    getAnalyses(opts = {}) {
      const limit = Math.min(
        Number.isInteger(opts.limit) && opts.limit > 0 ? opts.limit : 50,
        1000
      );
      const offset = Number.isInteger(opts.offset) && opts.offset >= 0 ? opts.offset : 0;

      let sql = `
        SELECT
          a.id, a.item_id, a.decision, a.confidence,
          a.summary, a.impact, a.action_items, a.tags, a.created_at,
          p.feed_url, p.title, p.link, p.published_at, p.processed_at
        FROM analyses a
        JOIN processed_items p ON p.id = a.item_id
        WHERE 1=1
      `;
      const params = [];

      if (opts.feedUrl) {
        sql += ' AND p.feed_url = ?';
        params.push(opts.feedUrl);
      }
      if (opts.decision === 'relevant' || opts.decision === 'ignore') {
        sql += ' AND a.decision = ?';
        params.push(opts.decision);
      }

      sql += ' ORDER BY a.created_at DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      return db.prepare(sql).all(...params).map((row) => ({
        ...row,
        actionItems: JSON.parse(row.action_items),
        tags: JSON.parse(row.tags)
      }));
    },

    pruneOlderThan(ttlDays) {
      if (typeof ttlDays !== 'number' || ttlDays <= 0) {
        throw new TypeError('pruneOlderThan: ttlDays must be a positive number');
      }

      const days = -Math.trunc(ttlDays);

      const deletedAnalyses = db
        .prepare(
          `DELETE FROM analyses WHERE item_id IN (
             SELECT id FROM processed_items
             WHERE processed_at < datetime('now', CAST(? AS TEXT) || ' days')
           )`
        )
        .run(days).changes;

      const deletedItems = db
        .prepare(
          `DELETE FROM processed_items
           WHERE processed_at < datetime('now', CAST(? AS TEXT) || ' days')`
        )
        .run(days).changes;

      return { deletedItems, deletedAnalyses };
    },

    close() {
      db.close();
    }
  };
}

// Synchronous wrapper so the file stays synchronous at module scope but
// node:sqlite is only resolved when createStorage() is actually called.
function await_import_sync() {
  // This is a synchronous dynamic require pattern safe for CJS-wrapped ESM.
  // node:sqlite is built-in so there is no network call.
  return require('node:sqlite');
}

/**
 * Create a lightweight in-memory StorageAdapter.
 *
 * Suitable for:
 *   - Unit / integration tests (no filesystem, no Node version constraint)
 *   - Node 18/20 environments (no node:sqlite built-in)
 *   - Stateless/ephemeral deployments that don't need persistence
 *
 * Data is lost when the process exits. Use createStorage() for persistence.
 *
 * @returns {StorageAdapter}
 */
export function createMemoryStorage() {
  const processed = new Map();  // id → item
  const analyses = new Map();   // id → analysis row
  const analysesByItemId = new Map(); // itemId → analysis id

  return {
    hasProcessed(id) {
      return processed.has(id);
    },

    markProcessed(item) {
      if (!processed.has(item.id)) {
        processed.set(item.id, {
          ...item,
          // Honour item.processedAt when provided (backfill / migration / tests).
          // Falls back to the current wall-clock time, matching the SQLite
          // DEFAULT CURRENT_TIMESTAMP behaviour of createStorage().
          processed_at: item.processedAt ?? new Date().toISOString()
        });
      }
    },

    saveAnalysis(itemId, analysis) {
      if (!analysesByItemId.has(itemId)) {
        const row = {
          id: analysis.id,
          item_id: itemId,
          decision: analysis.decision,
          confidence: analysis.confidence,
          summary: analysis.summary,
          impact: analysis.impact,
          actionItems: analysis.actionItems,
          tags: analysis.tags,
          created_at: new Date().toISOString()
        };
        analyses.set(analysis.id, row);
        analysesByItemId.set(itemId, analysis.id);
      }
    },

    getAnalyses(opts = {}) {
      const limit = Math.min(
        Number.isInteger(opts.limit) && opts.limit > 0 ? opts.limit : 50,
        1000
      );
      const offset = Number.isInteger(opts.offset) && opts.offset >= 0 ? opts.offset : 0;

      let rows = [...analyses.values()].map((a) => {
        const item = processed.get(a.item_id) || {};
        return {
          ...a,
          feed_url: item.feedUrl || '',
          title: item.title || '',
          link: item.link || null,
          published_at: item.publishedAt || null,
          processed_at: item.processed_at || null
        };
      });

      if (opts.feedUrl) {
        rows = rows.filter((r) => r.feed_url === opts.feedUrl);
      }
      if (opts.decision === 'relevant' || opts.decision === 'ignore') {
        rows = rows.filter((r) => r.decision === opts.decision);
      }

      rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
      return rows.slice(offset, offset + limit);
    },

    pruneOlderThan(ttlDays) {
      if (typeof ttlDays !== 'number' || ttlDays <= 0) {
        throw new TypeError('pruneOlderThan: ttlDays must be a positive number');
      }
      const cutoff = new Date(Date.now() - ttlDays * 86_400_000).toISOString();
      let deletedItems = 0;
      let deletedAnalyses = 0;

      for (const [id, item] of processed) {
        if ((item.processed_at || '') < cutoff) {
          const analysisId = analysesByItemId.get(id);
          if (analysisId) {
            analyses.delete(analysisId);
            analysesByItemId.delete(id);
            deletedAnalyses++;
          }
          processed.delete(id);
          deletedItems++;
        }
      }
      return { deletedItems, deletedAnalyses };
    },

    close() {
      // No-op for in-memory storage — nothing to flush or close.
    }
  };
}
