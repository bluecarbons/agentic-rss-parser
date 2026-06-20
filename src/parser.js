import crypto from 'node:crypto';
import { analyzeFeedItem } from './agent.js';
import { createStorage } from './storage.js';
import { createAnalyzer } from './adapters/provider.js';
import { parseFeedXml } from './core/parser.js';

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

  try {
    for (const feedUrl of config.feedUrls) {
      const xml = await fetchFeed(feedUrl, config.parserOptions);
      const feed = await parseFeedXml(xml, config.parserOptions);
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
    }
    return results;
  } finally {
    storage.close();
  }
}

async function fetchFeed(feedUrl, parserOptions = {}) {
  assertHttpUrl(feedUrl);
  const controller = new AbortController();
  const timeoutMs = Number.isFinite(parserOptions.timeout) ? parserOptions.timeout : 10000;
  const timeoutId = setTimeout(() => controller.abort(new Error('Request timed out')), timeoutMs);
  const requestOptions = {
    ...parserOptions.requestOptions,
    signal: controller.signal,
    headers: {
      'user-agent': 'agentic-rss-parser/1.0.1',
      ...(parserOptions.headers || {}),
      ...(parserOptions.requestOptions?.headers || {})
    }
  };

  try {
    const response = await fetch(feedUrl, requestOptions);
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }
    return await response.text();
  } finally {
    clearTimeout(timeoutId);
  }
}

function assertHttpUrl(url) {
  const parsed = new URL(url);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`Unsupported feed URL protocol: ${parsed.protocol}`);
  }
}
