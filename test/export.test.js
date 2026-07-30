import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryStorage } from '../src/index.js';

test('exportForEmbedding — formats database records for vector ingestion', () => {
  const storage = createMemoryStorage();

  storage.markProcessed({
    id: 'item-1',
    feedUrl: 'https://news.ycombinator.com/rss',
    title: 'New AI Breakthrough',
    link: 'https://news.ycombinator.com/item?id=123',
    publishedAt: '2026-07-30T12:00:00Z'
  });

  storage.saveAnalysis('item-1', {
    id: 'analysis-1',
    decision: 'relevant',
    confidence: 95,
    summary: 'A new model achieved benchmark SOTA.',
    impact: 'Will shift LLM infrastructure.',
    actionItems: ['Read paper'],
    tags: ['ai', 'llm']
  });

  const docs = storage.exportForEmbedding({ decision: 'relevant' });

  assert.equal(docs.length, 1);
  assert.equal(docs[0].id, 'analysis-1');
  assert.match(docs[0].text, /Title: New AI Breakthrough/);
  assert.match(docs[0].text, /Summary: A new model achieved benchmark SOTA\./);
  assert.match(docs[0].text, /Tags: ai, llm/);
  assert.equal(docs[0].metadata.feedUrl, 'https://news.ycombinator.com/rss');
  assert.equal(docs[0].metadata.decision, 'relevant');
});
