import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createParser } from '../src/compat.js';

test('ParserCompat forwards normalize=false without altering fields', async () => {
  const parser = createParser({
    normalize: false,
    customFields: {
      item: [['dc:creator', 'creator']]
    }
  });

  const xml = `<?xml version="1.0"?><rss version="2.0"><channel><title>Feed</title><item><title>Hello</title><link>https://example.com/a</link><dc:creator xmlns:dc="http://purl.org/dc/elements/1.1/">Jane Doe</dc:creator></item></channel></rss>`;
  const feed = await parser.parseString(xml);

  assert.equal(feed.title, 'Feed');
  assert.equal(feed.items[0].creator, 'Jane Doe');
});

test('ParserCompat preserves customFields keepArray semantics', async () => {
  const parser = createParser({
    customFields: {
      item: [['media:content', 'mediaContent', { keepArray: true }]]
    }
  });

  const xml = `<?xml version="1.0"?><rss version="2.0"><channel><title>Feed</title><item><title>Hello</title><link>https://example.com/a</link><media:content xmlns:media="http://search.yahoo.com/mrss/" url="https://example.com/1.jpg"/><media:content xmlns:media="http://search.yahoo.com/mrss/" url="https://example.com/2.jpg"/></item></channel></rss>`;
  const feed = await parser.parseString(xml);

  assert.ok(Array.isArray(feed.items[0].mediaContent));
  assert.equal(feed.items[0].mediaContent.length, 2);
});

test('ParserCompat parseURL follows redirects through the underlying parser', async () => {
  const server = http.createServer((req, res) => {
    if (req.url === '/feed.xml') {
      res.writeHead(200, { 'content-type': 'application/rss+xml' });
      res.end(`<?xml version="1.0"?><rss version="2.0"><channel><title>Feed</title><item><title>Hello</title><link>https://example.com/a</link></item></channel></rss>`);
      return;
    }

    res.writeHead(302, { Location: '/feed.xml' });
    res.end();
  });

  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const parser = createParser({ _allowPrivateHosts: true });

  try {
    const feed = await parser.parseURL(`http://127.0.0.1:${port}/redirect`);
    assert.equal(feed.title, 'Feed');
    assert.equal(feed.items[0].title, 'Hello');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
