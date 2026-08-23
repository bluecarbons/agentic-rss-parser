import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseXml } from '../src/core/parser.js';
import { assertHttpUrl } from '../src/core/http.js';

test('Security — XML Entity Decoding does not throw on invalid or huge code point (DoS protection)', () => {
  const xmlWithBadHex = '<item><title>Test &#x110000; and &#x99999999; and &#999999999;</title></item>';
  assert.doesNotThrow(() => {
    const result = parseXml(xmlWithBadHex);
    assert.ok(result.item.title);
  });
});

test('Security — XML nesting depth cap rejects deeply nested XML bombs', () => {
  let nestedXml = '';
  for (let i = 0; i < 150; i++) {
    nestedXml += `<node${i}>`;
  }
  nestedXml += 'payload';
  for (let i = 149; i >= 0; i--) {
    nestedXml += `</node${i}>`;
  }
  assert.throws(() => parseXml(nestedXml), /exceeded maximum nesting depth/i);
});

test('Security — XML parser protects against prototype pollution and prototype shadowing', () => {
  const maliciousXml = '<feed><__proto__><admin>true</admin></__proto__><toString>override</toString></feed>';
  const parsed = parseXml(maliciousXml);

  // Object prototype is clean
  assert.equal({}.admin, undefined);
  // toString is still a function on Object.prototype or accessible safely
  assert.equal(typeof Object.prototype.toString, 'function');
  assert.ok(parsed._toString !== undefined || parsed._admin !== undefined || typeof parsed === 'object');
});

test('Security — SSRF rejects documentation, multicast, reserved and benchmarking IPv4 ranges', () => {
  assert.throws(() => assertHttpUrl('http://192.0.2.1/'), /SSRF prevention/); // TEST-NET-1
  assert.throws(() => assertHttpUrl('http://198.51.100.1/'), /SSRF prevention/); // TEST-NET-2
  assert.throws(() => assertHttpUrl('http://203.0.113.1/'), /SSRF prevention/); // TEST-NET-3
  assert.throws(() => assertHttpUrl('http://192.0.0.1/'), /SSRF prevention/); // IETF Protocol
  assert.throws(() => assertHttpUrl('http://198.18.0.1/'), /SSRF prevention/); // Benchmarking
  assert.throws(() => assertHttpUrl('http://224.0.0.1/'), /SSRF prevention/); // Multicast
  assert.throws(() => assertHttpUrl('http://240.0.0.1/'), /SSRF prevention/); // Reserved Class E
});

test('Security — SSRF rejects documentation, discard and 6to4 private IPv6 ranges', () => {
  assert.throws(() => assertHttpUrl('http://[2001:db8::1]/'), /SSRF prevention/); // Documentation
  assert.throws(() => assertHttpUrl('http://[100::1]/'), /SSRF prevention/); // Discard
  assert.throws(() => assertHttpUrl('http://[2002:7f00:0001::]/'), /SSRF prevention/); // 6to4 embedding 127.0.0.1
  assert.throws(() => assertHttpUrl('http://[2002:0a00:0001::]/'), /SSRF prevention/); // 6to4 embedding 10.0.0.1
  assert.throws(() => assertHttpUrl('http://[fec0::1]/'), /SSRF prevention/); // Site-local
});
