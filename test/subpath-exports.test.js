import test from 'node:test';
import assert from 'node:assert/strict';

test('Subpath Export: agentic-rss-parser/core exports pure XML utilities', async () => {
  const { parseFeedXml, parseFeedString, stripHtml, parseXml } = await import('agentic-rss-parser/core');
  assert.equal(typeof parseFeedXml, 'function');
  assert.equal(typeof parseFeedString, 'function');
  assert.equal(typeof stripHtml, 'function');
  assert.equal(typeof parseXml, 'function');

  const xml = '<rss><channel><title>Test Feed</title><item><title>Item 1</title></item></channel></rss>';
  const feed = parseFeedXml(xml);
  assert.equal(feed.title, 'Test Feed');
  assert.equal(feed.items.length, 1);
  assert.equal(feed.items[0].title, 'Item 1');
});

test('Subpath Export: agentic-rss-parser/json exports JSON Feed utilities', async () => {
  const { isJsonFeed, parseJsonFeed } = await import('agentic-rss-parser/json');
  assert.equal(typeof isJsonFeed, 'function');
  assert.equal(typeof parseJsonFeed, 'function');

  const jsonFeed = JSON.stringify({
    version: 'https://jsonfeed.org/version/1.1',
    title: 'JSON Feed Test',
    items: [{ id: '1', title: 'Article 1' }]
  });
  assert.equal(isJsonFeed(jsonFeed), true);
  const parsed = parseJsonFeed(jsonFeed);
  assert.equal(parsed.title, 'JSON Feed Test');
  assert.equal(parsed.items.length, 1);
});

test('Subpath Export: agentic-rss-parser/opml exports OPML parser', async () => {
  const { parseOpml } = await import('agentic-rss-parser/opml');
  assert.equal(typeof parseOpml, 'function');

  const opml = `<?xml version="1.0"?>
    <opml version="2.0">
      <head><title>Subscriptions</title></head>
      <body>
        <outline text="Tech" title="Tech">
          <outline type="rss" text="Hacker News" xmlUrl="https://hnrss.org/frontpage" />
        </outline>
      </body>
    </opml>`;
  const result = parseOpml(opml);
  assert.equal(result.title, 'Subscriptions');
  assert.equal(result.feeds.length, 1);
  assert.equal(result.feeds[0].title, 'Hacker News');
  assert.equal(result.feeds[0].category, 'Tech');
});

test('Subpath Export: agentic-rss-parser/agent exports heuristic and scoring utilities', async () => {
  const { heuristicAnalyze, DEFAULT_HEURISTIC_SIGNALS, resolveSignals, analyzeFeedItem } = await import('agentic-rss-parser/agent');
  assert.equal(typeof heuristicAnalyze, 'function');
  assert.equal(typeof resolveSignals, 'function');
  assert.equal(typeof analyzeFeedItem, 'function');
  assert.ok(Array.isArray(DEFAULT_HEURISTIC_SIGNALS));

  const analysis = heuristicAnalyze({ title: 'Critical Security Vulnerability in Node.js' });
  assert.equal(analysis.decision, 'relevant');
  assert.ok(analysis.confidence > 50);
});

test('Subpath Export: agentic-rss-parser/storage exports storage creators', async () => {
  const { createStorage, createMemoryStorage } = await import('agentic-rss-parser/storage');
  assert.equal(typeof createStorage, 'function');
  assert.equal(typeof createMemoryStorage, 'function');

  const storage = createMemoryStorage();
  assert.equal(storage.hasProcessed('non-existent'), false);
});

test('Subpath Export: agentic-rss-parser/watcher exports createFeedWatcher', async () => {
  const { createFeedWatcher } = await import('agentic-rss-parser/watcher');
  assert.equal(typeof createFeedWatcher, 'function');
});

test('Subpath Export: agentic-rss-parser/mcp exports MCP tools definition', async () => {
  const { tools } = await import('agentic-rss-parser/mcp');
  assert.ok(Array.isArray(tools));
  assert.ok(tools.some(t => t.name === 'fetch_rss_feed'));
  assert.ok(tools.some(t => t.name === 'search_feed_history'));
});
