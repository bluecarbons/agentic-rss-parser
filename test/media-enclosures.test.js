import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFeedXml } from '../src/core/parser.js';

test('parseFeedXml extracts podcast and media RSS enclosures correctly', () => {
  const xml = `
    <rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:media="http://search.yahoo.com/mrss/">
      <channel>
        <title>Tech Podcast</title>
        <item>
          <title>Episode 42: Agentic Systems</title>
          <enclosure url="https://cdn.example.com/ep42.mp3" length="4567890" type="audio/mpeg"/>
          <media:thumbnail url="https://cdn.example.com/ep42-art.jpg"/>
          <itunes:duration>00:45:30</itunes:duration>
          <itunes:episode>42</itunes:episode>
          <itunes:author>Host Name</itunes:author>
        </item>
      </channel>
    </rss>
  `;

  const feed = parseFeedXml(xml);
  assert.equal(feed.items.length, 1);
  const item = feed.items[0];
  assert.equal(item.enclosure?.url, 'https://cdn.example.com/ep42.mp3');
  assert.equal(item.enclosure?.length, '4567890');
  assert.equal(item.enclosure?.type, 'audio/mpeg');
  assert.equal(item.media?.thumbnail, 'https://cdn.example.com/ep42-art.jpg');
  assert.equal(item.itunes?.duration, '00:45:30');
  assert.equal(item.itunes?.episode, '42');
  assert.equal(item.itunes?.author, 'Host Name');
  assert.equal(item.creator, 'Host Name');
});

test('parseFeedXml extracts Atom enclosure links', () => {
  const atomXml = `
    <feed xmlns="http://www.w3.org/2005/Atom">
      <title>Atom Feed with Enclosures</title>
      <entry>
        <title>Atom Audio Episode</title>
        <link rel="enclosure" href="https://example.com/podcast.m4a" type="audio/mp4" length="88888"/>
      </entry>
    </feed>
  `;

  const feed = parseFeedXml(atomXml);
  assert.equal(feed.items.length, 1);
  const item = feed.items[0];
  assert.equal(item.enclosure?.url, 'https://example.com/podcast.m4a');
  assert.equal(item.enclosure?.type, 'audio/mp4');
  assert.equal(item.enclosure?.length, '88888');
});
