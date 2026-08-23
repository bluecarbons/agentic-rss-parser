import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseJsonFeed, isJsonFeed } from '../src/core/json-feed.js';
import { parseFeedXml } from '../src/core/parser.js';

const SAMPLE_JSON_FEED = JSON.stringify({
  version: 'https://jsonfeed.org/version/1.1',
  title: 'Engineering Blog',
  home_page_url: 'https://example.com',
  feed_url: 'https://example.com/feed.json',
  description: 'Tech updates',
  items: [
    {
      id: 'post-101',
      url: 'https://example.com/post-101',
      title: 'Agentic AI Architecture',
      content_html: '<p>Deep dive into agents.</p>',
      summary: 'Deep dive into agents summary.',
      date_published: '2026-08-20T10:00:00Z',
      tags: ['ai', 'agents', 'architecture'],
      authors: [{ name: 'Jane Doe' }],
      image: 'https://example.com/thumb.jpg',
      attachments: [
        {
          url: 'https://example.com/audio.mp3',
          mime_type: 'audio/mpeg',
          size_in_bytes: 1234567
        }
      ]
    }
  ]
});

test('isJsonFeed accurately identifies JSON Feed strings and objects', () => {
  assert.equal(isJsonFeed(SAMPLE_JSON_FEED), true);
  assert.equal(isJsonFeed(JSON.parse(SAMPLE_JSON_FEED)), true);
  assert.equal(isJsonFeed('<rss version="2.0"><channel></channel></rss>'), false);
  assert.equal(isJsonFeed('{"version": "something-else"}'), false);
});

test('parseJsonFeed correctly normalizes items according to standard Feed schema', () => {
  const feed = parseJsonFeed(SAMPLE_JSON_FEED);
  assert.equal(feed.title, 'Engineering Blog');
  assert.equal(feed.link, 'https://example.com');
  assert.equal(feed.items.length, 1);

  const item = feed.items[0];
  assert.equal(item.title, 'Agentic AI Architecture');
  assert.equal(item.guid, 'post-101');
  assert.equal(item.link, 'https://example.com/post-101');
  assert.equal(item.isoDate, '2026-08-20T10:00:00.000Z');
  assert.equal(item.creator, 'Jane Doe');
  assert.deepEqual(item.categories, ['ai', 'agents', 'architecture']);
  assert.equal(item.media?.thumbnail, 'https://example.com/thumb.jpg');
  assert.equal(item.enclosure?.url, 'https://example.com/audio.mp3');
  assert.equal(item.enclosure?.type, 'audio/mpeg');
  assert.equal(item.enclosure?.length, '1234567');
});

test('parseFeedXml auto-detects and seamlessly parses JSON Feed input', () => {
  const feed = parseFeedXml(SAMPLE_JSON_FEED);
  assert.equal(feed.title, 'Engineering Blog');
  assert.equal(feed.items.length, 1);
  assert.equal(feed.items[0].title, 'Agentic AI Architecture');
});
