import crypto from 'node:crypto';
import { analyzeFeedItem } from './agent.js';
import { createStorage } from './storage.js';
import { createAnalyzer } from './adapters/provider.js';
import { parseFeedXml } from './core/parser.js';
import { fetchTextWithRedirects } from './core/http.js';

function normalizeItem(feedUrl, item) {
  const link = item.link || '';

  // CORRECTNESS — deduplication stability fix:
  // The previous fallback chain ended with crypto.randomUUID(), meaning items
  // with no link/guid/title/pubDate received a fresh UUID every run. This
  // silently defeated deduplication — the same item was re-processed on every
  // execution. Replacing UUID with an empty-string sentinel produces a stable
  // (if non-unique) hash tied to feedUrl alone, which at least makes the ID
  // deterministic. Callers that need uniqueness per blank item can extend the
  // idSource with an index or sequence number.
  const idSource = link || item.guid || item.title || item.pubDate || '';
  const id = crypto
    .createHash('sha256')
    .update(`${feedUrl}:${idSource}`)
    .digest('hex');
  return {
    id,
    feedUrl,
    title: item.title?.trim() || 'Untitled item',
    link,
    publishedAt: item.isoDate || item.pubDate || null,
    contentSnippet: item.contentSnippet || item.content || ''
  };
}

/**
 * Run the agentic parser pipeline over one or more feed URLs.
 *
 * @param {object} config
 * @param {string[]} config.feedUrls        - Feed URLs to process (required, non-empty array).
 * @param {string}   config.dbPath          - Absolute path to the SQLite database (required).
 * @param {boolean}  [config.fetchFullArticle] - Fetch full article body for context.
 * @param {number}   [config.concurrency]   - Max parallel feed fetches (default: 1, max: 16).
 * @param {object}   [config.parserOptions] - Options forwarded to parseFeedXml.
 * @param {Function} [config.analyzer]      - Custom analyzer function.
 * @param {object}   [config.model]         - Provider/model config for createAnalyzer.
 *
 * @returns {Promise<{ results: Array, feedErrors: Array }>}
 *   results    — successfully analysed { item, analysis } pairs.
 *   feedErrors — per-feed errors: { feedUrl, error } for feeds that failed.
 */
export async function runAgenticParser(config) {
  if (!Array.isArray(config?.feedUrls) || config.feedUrls.length === 0) {
    throw new TypeError('runAgenticParser: config.feedUrls must be a non-empty array of URL strings');
  }
  if (typeof config.dbPath !== 'string' || !config.dbPath.trim()) {
    throw new TypeError('runAgenticParser: config.dbPath must be a non-empty string');
  }

  const storage = createStorage(config.dbPath);
  const results = [];
  const feedErrors = [];
  const analyzer = config.analyzer ?? (await createAnalyzer(config.model));
  const concurrency = normalizeConcurrency(config.concurrency);

  try {
    await mapWithConcurrency(
      config.feedUrls,
      concurrency,
      async (feedUrl) => {
        try {
          const xml = await fetchTextWithRedirects(feedUrl, config.parserOptions);
          const feed = parseFeedXml(xml, config.parserOptions);

          for (const item of feed.items) {
            const normalized = normalizeItem(feedUrl, item);
            if (storage.hasProcessed(normalized.id)) continue;

            const analysis = await analyzeFeedItem(normalized, {
              fetchFullArticle: config.fetchFullArticle,
              analyzer
            });

            storage.markProcessed(normalized);
            storage.saveAnalysis(normalized.id, {
              id: crypto.randomUUID(),
              ...analysis
            });
            results.push({ item: normalized, analysis });
          }
        } catch (err) {
          feedErrors.push({ feedUrl, error: err.message });
        }
      }
    );

    return { results, feedErrors };
  } finally {
    storage.close();
  }
}

function normalizeConcurrency(concurrency) {
  const parsed = Number(concurrency);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.min(16, Math.trunc(parsed));
}

/**
 * Run `worker` over every element in `items` with at most `limit`
 * concurrent workers. Returns void — results are accumulated via
 * the worker's own side-effects (closure over outer `results` array).
 */
async function mapWithConcurrency(items, limit, worker) {
  let index = 0;

  async function next() {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      await worker(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => next())
  );
}
