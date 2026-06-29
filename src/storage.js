import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export function createStorage(dbPath) {
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
      // CORRECTNESS: store NULL for link-less items instead of empty string.
      // The link column is now nullable (TEXT without NOT NULL) so that:
      //   1. WHERE link IS NULL correctly identifies link-less items.
      //   2. WHERE link = '' never returns false positives.
      //   3. Consumers calling getAnalyses() can distinguish "no link" from
      //      "link was not fetched".
      db
        .prepare(
          'INSERT OR IGNORE INTO processed_items (id, feed_url, title, link, published_at) VALUES (?, ?, ?, ?, ?)'
        )
        .run(item.id, item.feedUrl, item.title, item.link || null, item.publishedAt ?? null);
    },

    saveAnalysis(itemId, analysis) {
      // INSERT OR IGNORE: preserves the original created_at on duplicate rows.
      // INSERT OR REPLACE would delete + reinsert, silently resetting created_at.
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

    /**
     * Query stored analyses with optional filtering.
     *
     * @param {object} [opts]
     * @param {string}  [opts.feedUrl]   - Filter to a specific feed URL.
     * @param {string}  [opts.decision]  - Filter by decision: 'relevant' | 'ignore'.
     * @param {number}  [opts.limit=50]  - Maximum rows to return (max 1000).
     * @param {number}  [opts.offset=0]  - Pagination offset.
     * @returns {Array<object>} Array of analysis rows with parsed JSON fields.
     */
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

    /**
     * Prune processed_items and analyses older than `ttlDays` days.
     * Useful for long-running deployments to prevent unbounded SQLite growth.
     *
     * @param {number} ttlDays - Number of days to retain rows (must be > 0).
     * @returns {{ deletedItems: number, deletedAnalyses: number }}
     */
    pruneOlderThan(ttlDays) {
      if (typeof ttlDays !== 'number' || ttlDays <= 0) {
        throw new TypeError('pruneOlderThan: ttlDays must be a positive number');
      }

      // CORRECTNESS: use a parameterised binding for the day offset instead of
      // string interpolation. CAST(? AS TEXT) || ' days' produces the same
      // SQLite modifier string as the previous `-${Math.trunc(ttlDays)} days`
      // but avoids false-positive flags from static-analysis tools (Socket,
      // Semgrep) that treat any string interpolation near SQL as suspicious.
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
