import crypto from 'node:crypto';
import { analyzeFeedItem } from './agent.js';
import { createStorage } from './storage.js';
import { createAnalyzer } from './adapters/provider.js';
import { parseFeedXml } from './core/parser.js';
import { fetchTextWithRedirects } from './core/http.js';

function normalizeItem(feedUrl, item) {
  const link = item.link || item.guid || '';
  const id = crypto.createHash('sha256').update(`${feedUrl}:${link || item.title}`).digest('hex');
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
  const storage = createStorage(config.dbPath);
  const results = [];
  const analyzer = config.analyzer ?? await createAnalyzer(config.model);
  const concurrency = normalizeConcurrency(config.concurrency);

  try {
    const feedRuns = await mapWithConcurrency(config.feedUrls, concurrency, async (feedUrl) => {
      const xml = await fetchTextWithRedirects(feedUrl, config.parserOptions);
      const feed = await parseFeedXml(xml, config.parserOptions);
      const feedResults = [];

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
        feedResults.push({ item: normalized, analysis });
      }

      return feedResults;
    });

    results.push(...feedRuns.flat());
    return results;
  } finally {
    storage.close();
  }
}

function normalizeConcurrency(concurrency) {
  const parsed = Number(concurrency);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.min(16, Math.trunc(parsed));
}

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let index = 0;

  async function next() {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => next());
  await Promise.all(workers);
  return results;
}
