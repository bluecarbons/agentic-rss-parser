import test from 'node:test';
import assert from 'node:assert/strict';
import { runAgenticParser, createMemoryStorage } from '../src/index.js';

test('runAgenticParser — supports dynamic function resolver for parserOptions', async () => {
  const storage = createMemoryStorage();
  let resolvedUrl = '';

  const optionsResolver = (feedUrl) => {
    resolvedUrl = feedUrl;
    return {
      userAgent: 'CustomUA/1.0',
      timeout: 5000
    };
  };

  const { feedErrors } = await runAgenticParser({
    feedUrls: ['https://news.ycombinator.com/rss'],
    storage,
    parserOptions: optionsResolver
  });

  assert.equal(resolvedUrl, 'https://news.ycombinator.com/rss');
  assert.ok(Array.isArray(feedErrors));
});
