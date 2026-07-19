import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseXml } from '../src/core/parser.js';
import { assertHttpUrl, assertResolvedHostSafe, readBodyWithCap } from '../src/core/http.js';

test('parseXml — unquoted attribute values containing slashes are not truncated', () => {
  const xml = '<link href=http://example.com/feed/path>text</link>';
  const result = parseXml(xml);
  assert.equal(result.link['@_href'], 'http://example.com/feed/path');
});

test('parseXml — unquoted numeric and boolean-flag attributes still work', () => {
  const xml = '<item count=5 selected>text</item>';
  const result = parseXml(xml);
  assert.equal(result.item['@_count'], '5');
  assert.equal(result.item['@_selected'], '');
});

test('parseXml — self-closing tags with unquoted attributes still work', () => {
  const xml = '<img src=foo.jpg/>';
  const result = parseXml(xml);
  assert.equal(result.img['@_src'], 'foo.jpg');
});

test('assertHttpUrl — rejects IPv6 link-local literal (fe80::/10)', () => {
  assert.throws(() => assertHttpUrl('http://[fe80::1]/'), /SSRF prevention/);
});

test('assertHttpUrl — rejects IPv4-mapped IPv6 loopback literal', () => {
  assert.throws(() => assertHttpUrl('http://[::ffff:127.0.0.1]/'), /SSRF prevention/);
});

test('assertResolvedHostSafe — allows a normal public hostname', async () => {
  await assert.doesNotReject(assertResolvedHostSafe('https://example.com/'));
});

test('assertResolvedHostSafe — skipped entirely when allowPrivateHosts is set', async () => {
  await assert.doesNotReject(
    assertResolvedHostSafe('http://127.0.0.1/', { allowPrivateHosts: true })
  );
});

test('readBodyWithCap — aborts mid-stream when no content-length header lies about size', async () => {
  const chunk = new TextEncoder().encode('x'.repeat(1024 * 1024)); // 1 MB
  let sent = 0;
  const stream = new ReadableStream({
    pull(controller) {
      if (sent >= 6) {
        controller.close();
        return;
      }
      controller.enqueue(chunk);
      sent += 1;
    }
  });
  const response = new Response(stream);
  await assert.rejects(
    readBodyWithCap(response, 5 * 1024 * 1024, 'http://test'),
    /too large/
  );
});

test('readBodyWithCap — returns full text when under the cap', async () => {
  const response = new Response('hello world');
  const text = await readBodyWithCap(response, 1024, 'http://test');
  assert.equal(text, 'hello world');
});
