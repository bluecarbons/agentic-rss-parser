import test from 'node:test';
import assert from 'node:assert/strict';
import { parseOpml } from '../src/core/opml.js';

test('parseOpml — extracts title and feed outlines correctly', () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>My Tech Feeds</title>
  </head>
  <body>
    <outline text="Hacker News" title="Hacker News" type="rss" xmlUrl="https://news.ycombinator.com/rss" htmlUrl="https://news.ycombinator.com" />
    <outline text="Engineering Blogs">
      <outline text="Github Blog" title="Github Blog" type="rss" xmlUrl="https://github.blog/feed/" category="Dev" />
    </outline>
  </body>
</opml>`;

  const result = parseOpml(xml);

  assert.equal(result.title, 'My Tech Feeds');
  assert.equal(result.feeds.length, 2);

  assert.equal(result.feeds[0].title, 'Hacker News');
  assert.equal(result.feeds[0].xmlUrl, 'https://news.ycombinator.com/rss');
  assert.equal(result.feeds[0].htmlUrl, 'https://news.ycombinator.com');

  assert.equal(result.feeds[1].title, 'Github Blog');
  assert.equal(result.feeds[1].xmlUrl, 'https://github.blog/feed/');
  assert.equal(result.feeds[1].category, 'Engineering Blogs');
});

test('parseOpml — throws on invalid input', () => {
  assert.throws(() => parseOpml(''), TypeError);
  assert.throws(() => parseOpml(null), TypeError);
});
