/**
 * Tests for createMemoryStorage() — the pluggable in-memory StorageAdapter.
 *
 * These tests run on any Node version (no node:sqlite required) and
 * verify that the memory adapter honours the full StorageAdapter interface
 * contract so it can be used as a drop-in for createStorage() in tests
 * and Node 18/20 environments.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryStorage } from '../src/storage.js';

function makeItem(overrides = {}) {
  return {
    id: 'abc123',
    feedUrl: 'https://example.com/feed',
    title: 'Test Item',
    link: 'https://example.com/1',
    publishedAt: '2024-01-15T12:00:00.000Z',
    ...overrides
  };
}

function makeAnalysis(overrides = {}) {
  return {
    id: 'analysis-1',
    decision: 'relevant',
    confidence: 80,
    summary: 'Good item',
    impact: 'High',
    actionItems: ['Read it'],
    tags: ['node', 'release'],
    ...overrides
  };
}

test('createMemoryStorage — hasProcessed returns false for unknown id', () => {
  const storage = createMemoryStorage();
  assert.equal(storage.hasProcessed('nope'), false);
});

test('createMemoryStorage — markProcessed + hasProcessed', () => {
  const storage = createMemoryStorage();
  const item = makeItem();
  assert.equal(storage.hasProcessed(item.id), false);
  storage.markProcessed(item);
  assert.equal(storage.hasProcessed(item.id), true);
});

test('createMemoryStorage — markProcessed is idempotent (INSERT OR IGNORE semantics)', () => {
  const storage = createMemoryStorage();
  const item = makeItem();
  storage.markProcessed(item);
  assert.doesNotThrow(() => storage.markProcessed(item));
  assert.equal(storage.hasProcessed(item.id), true);
});

test('createMemoryStorage — saveAnalysis + getAnalyses round-trip', () => {
  const storage = createMemoryStorage();
  const item = makeItem();
  const analysis = makeAnalysis();
  storage.markProcessed(item);
  storage.saveAnalysis(item.id, analysis);

  const rows = storage.getAnalyses();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].decision, 'relevant');
  assert.equal(rows[0].confidence, 80);
  assert.deepEqual(rows[0].actionItems, ['Read it']);
  assert.deepEqual(rows[0].tags, ['node', 'release']);
});

test('createMemoryStorage — saveAnalysis is idempotent (INSERT OR IGNORE semantics)', () => {
  const storage = createMemoryStorage();
  const item = makeItem();
  storage.markProcessed(item);
  storage.saveAnalysis(item.id, makeAnalysis({ id: 'a1', confidence: 80 }));
  storage.saveAnalysis(item.id, makeAnalysis({ id: 'a1', confidence: 99 })); // should be ignored
  const rows = storage.getAnalyses();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].confidence, 80, 'second save must not overwrite first');
});

test('createMemoryStorage — getAnalyses filters by feedUrl', () => {
  const storage = createMemoryStorage();
  storage.markProcessed(makeItem({ id: '1', feedUrl: 'https://a.com/feed' }));
  storage.markProcessed(makeItem({ id: '2', feedUrl: 'https://b.com/feed' }));
  storage.saveAnalysis('1', makeAnalysis({ id: 'an1' }));
  storage.saveAnalysis('2', makeAnalysis({ id: 'an2', decision: 'ignore' }));

  const rows = storage.getAnalyses({ feedUrl: 'https://a.com/feed' });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].feed_url, 'https://a.com/feed');
});

test('createMemoryStorage — getAnalyses filters by decision', () => {
  const storage = createMemoryStorage();
  storage.markProcessed(makeItem({ id: '1' }));
  storage.markProcessed(makeItem({ id: '2' }));
  storage.saveAnalysis('1', makeAnalysis({ id: 'an1', decision: 'relevant' }));
  storage.saveAnalysis('2', makeAnalysis({ id: 'an2', decision: 'ignore' }));

  const relevant = storage.getAnalyses({ decision: 'relevant' });
  assert.equal(relevant.length, 1);
  assert.equal(relevant[0].decision, 'relevant');

  const ignored = storage.getAnalyses({ decision: 'ignore' });
  assert.equal(ignored.length, 1);
});

test('createMemoryStorage — getAnalyses pagination (limit + offset)', () => {
  const storage = createMemoryStorage();
  for (let i = 0; i < 10; i++) {
    storage.markProcessed(makeItem({ id: `item-${i}` }));
    storage.saveAnalysis(`item-${i}`, makeAnalysis({ id: `an-${i}` }));
  }
  const page1 = storage.getAnalyses({ limit: 3, offset: 0 });
  const page2 = storage.getAnalyses({ limit: 3, offset: 3 });
  assert.equal(page1.length, 3);
  assert.equal(page2.length, 3);
  // Pages must not overlap
  const ids1 = new Set(page1.map((r) => r.id));
  const ids2 = new Set(page2.map((r) => r.id));
  for (const id of ids2) assert.ok(!ids1.has(id), 'pages must not overlap');
});

test('createMemoryStorage — pruneOlderThan removes old entries', async () => {
  const storage = createMemoryStorage();
  const item = makeItem();
  storage.markProcessed(item);
  storage.saveAnalysis(item.id, makeAnalysis());

  // Pruning 0 days in the future — nothing should be removed
  // (processed_at is just now, so it's within 0.001 day threshold)
  // Use a very small TTL to force deletion
  // We need to wait 1ms to ensure processed_at < cutoff
  await new Promise((r) => setTimeout(r, 5));
  const { deletedItems, deletedAnalyses } = storage.pruneOlderThan(0.000001); // ~0.086 ms
  assert.equal(deletedItems, 1);
  assert.equal(deletedAnalyses, 1);
  assert.equal(storage.hasProcessed(item.id), false);
});

test('createMemoryStorage — pruneOlderThan throws on invalid ttlDays', () => {
  const storage = createMemoryStorage();
  assert.throws(() => storage.pruneOlderThan(0), /positive number/);
  assert.throws(() => storage.pruneOlderThan(-1), /positive number/);
  assert.throws(() => storage.pruneOlderThan('7'), /positive number/);
});

test('createMemoryStorage — close() is a no-op and does not throw', () => {
  const storage = createMemoryStorage();
  assert.doesNotThrow(() => storage.close());
});

test('createMemoryStorage — multiple independent instances do not share state', () => {
  const s1 = createMemoryStorage();
  const s2 = createMemoryStorage();
  s1.markProcessed(makeItem({ id: 'shared-id' }));
  assert.equal(s2.hasProcessed('shared-id'), false);
});
