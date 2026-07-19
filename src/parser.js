import crypto from 'node:crypto';
import { analyzeFeedItem } from './agent.js';
import { createStorage } from './storage.js';
import { createAnalyzer } from './adapters/provider.js';
import { parseFeedXml } from './core/parser.js';
import { fetchTextWithRedirects } from './core/http.js';

function normalizeItem(feedUrl, item) {
  const link = item.link || '';
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

export async function runAgenticParser(config) {
  if (!Array.isArray(config?.feedUrls) || config.feedUrls.length === 0) {
    throw new TypeError('runAgenticParser: config.feedUrls must be a non-empty array of URL strings');
  }

  let storage;
  if (config.storage) {
    storage = config.storage;
  } else {
    if (typeof config.dbPath !== 'string' || !config.dbPath.trim()) {
      throw new TypeError(
        'runAgenticParser: config.dbPath must be a non-empty string (or supply config.storage)'
      );
    }
    storage = createStorage(config.dbPath);
  }

  const results = [];
  const feedErrors = [];
  const analyzer = config.analyzer ?? (await createAnalyzer(config.model));
  const concurrency = normalizeConcurrency(config.concurrency);
  const maxItems = normalizeMaxItems(config.maxItems);

  // BUGFIX — maxItems race across concurrent feeds:
  // Feeds are processed concurrently (mapWithConcurrency), all sharing this
  // one counter. The previous check read `results.length` (only updated
  // after the awaited analyzeFeedItem/storage calls completed), so two
  // feeds' loops could both pass "results.length >= maxItems" before either
  // had pushed, letting the final result count slightly exceed maxItems.
  // `reservedItems` is incremented synchronously, in the same tick as the
  // check that guards it — no `await` occurs between the check and the
  // increment — so under Node's single-threaded cooperative scheduling no
  // other feed's loop iteration can run in between. That makes the
  // check-and-reserve atomic even though the two feed loops interleave.
  let reservedItems = 0;

  try {
    await mapWithConcurrency(
      config.feedUrls,
      concurrency,
      async (feedUrl) => {
        try {
          const result = await fetchTextWithRedirects(feedUrl, config.parserOptions);
          if (result === null) return;
          const xml = result.text;
          const feed = parseFeedXml(xml, config.parserOptions);

          for (const item of feed.items) {
            if (maxItems !== null && reservedItems >= maxItems) break;

            const normalized = normalizeItem(feedUrl, item);
            if (storage.hasProcessed(normalized.id)) continue;

            // Reserve the slot before the first `await` below.
            reservedItems += 1;

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
    if (!config.storage) {
      storage.close();
    }
  }
}

function normalizeConcurrency(concurrency) {
  const parsed = Number(concurrency);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.min(16, Math.trunc(parsed));
}

function normalizeMaxItems(maxItems) {
  if (maxItems === undefined || maxItems === null) return null;
  const parsed = Number(maxItems);
  if (!Number.isFinite(parsed) || parsed < 1) return null;
  return Math.trunc(parsed);
}

async function mapWithConcurrency(items, limit, worker) {
  const iter = items[Symbol.iterator]();

  async function drain() {
    for (const item of iter) {
      await worker(item);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, drain)
  );
}
