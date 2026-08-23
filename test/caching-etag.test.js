import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryStorage } from '../src/storage.js';

test('MemoryStorage — feed cache (getFeedCache / setFeedCache) persists ETag and Last-Modified', () => {
  const storage = createMemoryStorage();
  const feedUrl = 'https://example.com/feed.xml';

  assert.equal(storage.getFeedCache(feedUrl), null);

  storage.setFeedCache(feedUrl, {
    etag: '"abc123etag"',
    lastModified: 'Wed, 21 Oct 2025 07:28:00 GMT'
  });

  const cache = storage.getFeedCache(feedUrl);
  assert.equal(cache.etag, '"abc123etag"');
  assert.equal(cache.lastModified, 'Wed, 21 Oct 2025 07:28:00 GMT');
});

test('MemoryStorage — searchAnalyses matches titles, summaries, tags, and impact', () => {
  const storage = createMemoryStorage();
  storage.markProcessed({ id: 'item-1', feedUrl: 'https://news.com/rss', title: 'OpenAI releases new agent model' });
  storage.saveAnalysis('item-1', {
    id: 'a-1',
    decision: 'relevant',
    confidence: 90,
    summary: 'Breakthrough model for autonomous execution.',
    impact: 'Accelerates engineering pipelines.',
    actionItems: ['Evaluate benchmarks'],
    tags: ['openai', 'agents', 'ai']
  });

  const resultsByTitle = storage.searchAnalyses('openai');
  assert.equal(resultsByTitle.length, 1);
  assert.equal(resultsByTitle[0].title, 'OpenAI releases new agent model');

  const resultsBySummary = storage.searchAnalyses('autonomous');
  assert.equal(resultsBySummary.length, 1);

  const resultsByTag = storage.searchAnalyses('agents');
  assert.equal(resultsByTag.length, 1);

  const emptyResults = storage.searchAnalyses('nonexistentquery123');
  assert.equal(emptyResults.length, 0);
});

test('MemoryStorage — getStatistics returns accurate counts', () => {
  const storage = createMemoryStorage();
  storage.markProcessed({ id: 'i1', feedUrl: 'https://feed1.com/rss', title: 'Article 1' });
  storage.markProcessed({ id: 'i2', feedUrl: 'https://feed2.com/rss', title: 'Article 2' });
  storage.saveAnalysis('i1', {
    id: 'a1',
    decision: 'relevant',
    confidence: 85,
    summary: 'Important news',
    impact: 'High',
    actionItems: [],
    tags: ['tech']
  });
  storage.saveAnalysis('i2', {
    id: 'a2',
    decision: 'ignore',
    confidence: 80,
    summary: 'Noise',
    impact: 'None',
    actionItems: [],
    tags: []
  });

  const stats = storage.getStatistics();
  assert.equal(stats.totalProcessed, 2);
  assert.equal(stats.totalAnalyses, 2);
  assert.equal(stats.relevantCount, 1);
  assert.equal(stats.ignoreCount, 1);
  assert.equal(stats.feedsCount, 2);
});
