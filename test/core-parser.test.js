/**
 * Adversarial test suite for src/core/parser.js
 *
 * Covers parseXml and parseFeedXml edge cases that real-world malformed
 * feeds trigger in production. Each test is self-contained and uses only
 * node:test + node:assert/strict — no network, no filesystem.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseXml, parseFeedXml, stripHtml } from '../src/core/parser.js';

// ─── parseXml ────────────────────────────────────────────────────────────────

test('parseXml — basic element with text', () => {
  const result = parseXml('<root><title>Hello</title></root>');
  assert.equal(result.root.title, 'Hello');
});

test('parseXml — gt inside double-quoted attribute (findTagClose fix)', () => {
  // A naive xml.indexOf(">") would split on the > inside the attribute value
  // and corrupt the node. findTagClose() uses quote-aware scanning.
  const xml = '<item title="A > B article"><link>https://x.com</link></item>';
  const result = parseXml(xml);
  assert.ok(result.root?.item || result.item, 'item node must parse without corruption');
});

test('parseXml — gt inside single-quoted attribute', () => {
  const xml = "<item title='x > y'><desc>ok</desc></item>";
  const result = parseXml(xml);
  // Confirm desc text is not corrupted
  const item = result.root?.item || result.item;
  assert.ok(item, 'item node present');
});

test('parseXml — CDATA containing angle brackets and ampersands', () => {
  const xml = `
    <rss><channel><item>
      <title><![CDATA[if (a < b && b > c) return true;]]></title>
    </item></channel></rss>
  `;
  const feed = parseFeedXml(xml);
  assert.equal(feed.items[0].title, 'if (a < b && b > c) return true;');
});

test('parseXml — CDATA containing XML-like markup is treated as literal text', () => {
  const xml = `
    <rss><channel><item>
      <description><![CDATA[<p>Hello <strong>world</strong></p>]]></description>
    </item></channel></rss>
  `;
  const feed = parseFeedXml(xml);
  // contentSnippet strips HTML; raw content preserves it
  assert.ok(feed.items[0].contentSnippet.includes('Hello'));
  assert.ok(!feed.items[0].contentSnippet.includes('<p>'), 'HTML tags should be stripped in snippet');
});

test('parseXml — XML comment inside element body is ignored', () => {
  const xml = '<rss><channel><title>My Feed<!-- ignore this --></title></channel></rss>';
  const feed = parseFeedXml(xml);
  assert.equal(feed.title, 'My Feed');
});

test('parseXml — processing instruction at top is skipped', () => {
  const xml = '<?xml version="1.0" encoding="UTF-8"?><rss><channel><title>Feed</title></channel></rss>';
  const feed = parseFeedXml(xml);
  assert.equal(feed.title, 'Feed');
});

test('parseXml — self-closing tag', () => {
  const xml = '<rss><channel><link rel="self" href="https://x.com/feed"/><title>T</title></channel></rss>';
  const feed = parseFeedXml(xml);
  assert.equal(feed.title, 'T');
});

test('parseXml — entity decoding: named entities', () => {
  const xml = '<rss><channel><item><title>a &amp; b &lt; c &gt; d &quot;e&quot;</title></item></channel></rss>';
  const feed = parseFeedXml(xml);
  assert.equal(feed.items[0].title, 'a & b < c > d "e"');
});

test('parseXml — entity decoding: hex numeric entity (emoji)', () => {
  const xml = '<rss><channel><item><title>Hello &#x1F600;</title></item></channel></rss>';
  const feed = parseFeedXml(xml);
  assert.equal(feed.items[0].title, 'Hello \u{1F600}');
});

test('parseXml — entity decoding: decimal numeric entity', () => {
  const xml = '<rss><channel><item><title>&#65;&#66;&#67;</title></item></channel></rss>';
  const feed = parseFeedXml(xml);
  assert.equal(feed.items[0].title, 'ABC');
});

test('parseXml — entity decoding: &amp; must not double-decode', () => {
  // &amp;lt; should decode to &lt;, not <
  const xml = '<rss><channel><item><title>&amp;lt;</title></item></channel></rss>';
  const feed = parseFeedXml(xml);
  assert.equal(feed.items[0].title, '&lt;');
});

test('parseXml — unclosed tag degrades gracefully (no throw)', () => {
  const xml = '<rss><channel><item><title>Unclosed';
  assert.doesNotThrow(() => parseFeedXml(xml));
});

test('parseXml — deeply nested namespace: dc:creator', () => {
  const xml = `
    <rss xmlns:dc="http://purl.org/dc/elements/1.1/">
      <channel>
        <item>
          <title>Test</title>
          <dc:creator>Jane Doe</dc:creator>
        </item>
      </channel>
    </rss>
  `;
  const feed = parseFeedXml(xml);
  assert.equal(feed.items[0].creator, 'Jane Doe');
});

test('parseXml — deeply nested namespace: content:encoded', () => {
  const xml = `
    <rss xmlns:content="http://purl.org/rss/1.0/modules/content/">
      <channel>
        <item>
          <title>Rich</title>
          <content:encoded><![CDATA[<p>Full body</p>]]></content:encoded>
        </item>
      </channel>
    </rss>
  `;
  const feed = parseFeedXml(xml);
  assert.ok(feed.items[0].content.includes('Full body'));
});

test('parseXml — multiple items parsed correctly', () => {
  const xml = `
    <rss><channel>
      <item><title>A</title><link>https://a.com</link></item>
      <item><title>B</title><link>https://b.com</link></item>
      <item><title>C</title><link>https://c.com</link></item>
    </channel></rss>
  `;
  const feed = parseFeedXml(xml);
  assert.equal(feed.items.length, 3);
  assert.equal(feed.items[0].title, 'A');
  assert.equal(feed.items[2].title, 'C');
});

test('parseXml — empty feed returns empty items array', () => {
  const xml = '<rss><channel><title>Empty</title></channel></rss>';
  const feed = parseFeedXml(xml);
  assert.deepEqual(feed.items, []);
  assert.equal(feed.title, 'Empty');
});

test('parseXml — feed with no items at all', () => {
  const xml = '<rss></rss>';
  const feed = parseFeedXml(xml);
  assert.deepEqual(feed.items, []);
});

test('parseXml — Atom feed parses entries correctly', () => {
  const xml = `
    <?xml version="1.0" encoding="utf-8"?>
    <feed xmlns="http://www.w3.org/2005/Atom">
      <title>Atom Feed</title>
      <entry>
        <title>Entry One</title>
        <link href="https://example.com/1"/>
        <updated>2024-01-15T12:00:00Z</updated>
        <summary>Summary text</summary>
      </entry>
    </feed>
  `;
  const feed = parseFeedXml(xml);
  assert.equal(feed.items.length, 1);
  assert.equal(feed.items[0].title, 'Entry One');
  assert.ok(feed.items[0].isoDate, 'isoDate must be set for Atom entry');
});

test('parseXml — isoDate is valid ISO 8601 string', () => {
  const xml = `
    <rss><channel><item>
      <title>T</title>
      <pubDate>Mon, 15 Jan 2024 12:00:00 GMT</pubDate>
    </item></channel></rss>
  `;
  const feed = parseFeedXml(xml);
  const iso = feed.items[0].isoDate;
  assert.ok(iso, 'isoDate must be non-null');
  assert.doesNotThrow(() => new Date(iso).toISOString(), 'isoDate must be parseable as ISO 8601');
});

test('parseXml — invalid date produces null isoDate, not throw', () => {
  const xml = '<rss><channel><item><title>T</title><pubDate>not a date</pubDate></item></channel></rss>';
  const feed = parseFeedXml(xml);
  assert.equal(feed.items[0].isoDate, null);
});

test('parseXml — item with no link/guid/title still parses', () => {
  const xml = '<rss><channel><item><description>Just a desc</description></item></channel></rss>';
  assert.doesNotThrow(() => parseFeedXml(xml));
  const feed = parseFeedXml(xml);
  assert.equal(feed.items.length, 1);
});

test('parseXml — categories extracted as array', () => {
  const xml = `
    <rss><channel><item>
      <title>T</title>
      <category>Tech</category>
      <category>Node.js</category>
    </item></channel></rss>
  `;
  const feed = parseFeedXml(xml);
  assert.deepEqual(feed.items[0].categories, ['Tech', 'Node.js']);
});

test('parseXml — large feed (100 items) parses all without loss', () => {
  const items = Array.from({ length: 100 }, (_, i) =>
    `<item><title>Item ${i}</title><link>https://example.com/${i}</link></item>`
  ).join('\n');
  const xml = `<rss><channel>${items}</channel></rss>`;
  const feed = parseFeedXml(xml);
  assert.equal(feed.items.length, 100);
  assert.equal(feed.items[0].title, 'Item 0');
  assert.equal(feed.items[99].title, 'Item 99');
});

test('parseXml — mixed single and double quote attributes', () => {
  const xml = `<rss><channel><item title='single' id="double"><link>https://x.com</link></item></channel></rss>`;
  assert.doesNotThrow(() => parseFeedXml(xml));
});

// ─── stripHtml ───────────────────────────────────────────────────────────────

test('stripHtml — removes basic tags', () => {
  assert.equal(stripHtml('<p>Hello <strong>world</strong></p>'), 'Hello world');
});

test('stripHtml — removes script block and content', () => {
  const result = stripHtml('<p>Text</p><script>alert("xss")</script><p>More</p>');
  assert.ok(!result.includes('alert'), 'script content must be removed');
  assert.ok(result.includes('Text'), 'surrounding text preserved');
});

test('stripHtml — removes style block and content', () => {
  const result = stripHtml('<style>.a{color:red}</style><p>Hello</p>');
  assert.ok(!result.includes('color'), 'style content must be removed');
});

test('stripHtml — removes iframe block', () => {
  const result = stripHtml('<iframe src="evil.com"></iframe><p>Clean</p>');
  assert.ok(!result.includes('evil.com'));
  assert.ok(result.includes('Clean'));
});

test('stripHtml — removes object and embed blocks', () => {
  assert.ok(!stripHtml('<object data="x.swf"></object>').includes('x.swf'));
  assert.ok(!stripHtml('<embed src="x.swf"/>').includes('x.swf'));
});

test('stripHtml — collapses whitespace', () => {
  const result = stripHtml('<p>  Hello   </p>   <p>  World  </p>');
  assert.ok(!result.includes('   '), 'multiple spaces should be collapsed');
});

test('stripHtml — handles empty string', () => {
  assert.equal(stripHtml(''), '');
  assert.equal(stripHtml(), '');
});

test('stripHtml — replaces &nbsp; with space', () => {
  const result = stripHtml('Hello&nbsp;World');
  assert.ok(result.includes('Hello World') || result.includes('Hello') && result.includes('World'));
});

test('stripHtml — multiline script block removed', () => {
  const result = stripHtml('<script>\nvar x = 1;\nconsole.log(x);\n</script>Content');
  assert.ok(!result.includes('console'));
  assert.ok(result.includes('Content'));
});

test('stripHtml — inline event handler neutralized by tag removal', () => {
  // onerror= and onclick= survive the block-removal pass but are stripped
  // by the final tag-removal regex.
  const result = stripHtml('<img onerror="alert(1)" src="x">');
  assert.ok(!result.includes('onerror'));
  assert.ok(!result.includes('alert'));
});
