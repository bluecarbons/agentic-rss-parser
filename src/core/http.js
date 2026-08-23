import { lookup as dnsLookup } from 'node:dns/promises';
import pkg from '../../package.json' with { type: 'json' };

// Default User-Agent string. Callers can override via options.userAgent or options.headers['user-agent'].
const DEFAULT_USER_AGENT = `agentic-rss-parser/${pkg.version}`;

// Hard cap on response body size (5 MB). Prevents OOM on unexpectedly large
// or malicious feed responses.
const MAX_BODY_BYTES = 5 * 1024 * 1024;

const PRIVATE_HOSTNAME_PATTERNS = [/^localhost$/i];

/**
 * Numeric IPv4 private/loopback/reserved range check.
 *
 * SECURITY: this is used both for literal IPv4 addresses appearing directly
 * in a URL and for addresses returned by DNS resolution (see
 * `assertResolvedHostSafe` below) — the latter is what closes the
 * DNS-rebinding gap: a hostname string like "evil.example.com" doesn't match
 * any hostname regex, but if it *resolves* to 127.0.0.1 or
 * 169.254.169.254, the connection must still be rejected.
 *
 * @param {string} ip - Dotted-quad IPv4 address.
 * @returns {boolean}
 */
function isPrivateIPv4(ip) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
  if (!m) return false;
  const octets = m.slice(1, 5).map(Number);
  if (octets.some((o) => o > 255)) return false;
  const [a, b, c] = octets;
  if (a === 127) return true;                              // 127.0.0.0/8 loopback
  if (a === 10) return true;                               // 10.0.0.0/8 private
  if (a === 192 && b === 168) return true;                 // 192.168.0.0/16 private
  if (a === 172 && b >= 16 && b <= 31) return true;        // 172.16.0.0/12 private
  if (a === 169 && b === 254) return true;                 // 169.254.0.0/16 link-local / AWS metadata
  if (a === 100 && b >= 64 && b <= 127) return true;       // 100.64.0.0/10 carrier-grade NAT
  if (a === 0) return true;                                // 0.0.0.0/8 "this network"
  if (a === 192 && b === 0 && c === 2) return true;        // 192.0.2.0/24 TEST-NET-1 (RFC 5737)
  if (a === 198 && b === 51 && c === 100) return true;     // 198.51.100.0/24 TEST-NET-2 (RFC 5737)
  if (a === 203 && b === 0 && c === 113) return true;      // 203.0.113.0/24 TEST-NET-3 (RFC 5737)
  if (a === 192 && b === 0 && c === 0) return true;        // 192.0.0.0/24 IETF Protocol Assignments (RFC 6890)
  if (a === 198 && (b === 18 || b === 19)) return true;    // 198.18.0.0/15 benchmarking (RFC 2544)
  if (a >= 224 && a <= 239) return true;                   // 224.0.0.0/4 multicast (RFC 5771)
  if (a >= 240) return true;                               // 240.0.0.0/4 reserved / broadcast (includes 255.255.255.255)
  return false;
}

/**
 * Extract the embedded IPv4 address from an IPv4-mapped IPv6 literal, in
 * either its dotted-quad form (::ffff:127.0.0.1 — how a caller is likely to
 * write it) or the compressed hex-group form Node's own URL parser
 * normalises it to (::ffff:7f00:1 — e.g. `new URL('http://[::ffff:127.0.0.1]/')
 * .hostname` returns "[::ffff:7f00:1]"). Returns null if `ip` isn't either form.
 *
 * @param {string} lower - Lowercased, unbracketed IPv6 address.
 * @returns {string|null} Dotted-quad IPv4 string, or null.
 */
function extractIPv4Mapped(lower) {
  const dotted = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(lower);
  if (dotted) return dotted[1];

  const hex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(lower);
  if (hex) {
    const hi = parseInt(hex[1], 16);
    const lo = parseInt(hex[2], 16);
    return `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
  }
  return null;
}

/**
 * Numeric IPv6 private/loopback/reserved range check.
 *
 * @param {string} ip - IPv6 address, with or without surrounding brackets.
 * @returns {boolean}
 */
function isPrivateIPv6(ip) {
  const lower = ip.toLowerCase().replace(/^\[|\]$/g, '');
  if (lower === '::1' || lower === '::') return true;         // loopback / unspecified
  if (/^fc[0-9a-f]{2}:/.test(lower) || /^fd[0-9a-f]{2}:/.test(lower)) return true; // ULA fc00::/7
  if (/^fe[89ab][0-9a-f]:/.test(lower)) return true;          // link-local fe80::/10
  if (/^fec[0-9a-f]:/.test(lower) || /^fed[0-9a-f]:/.test(lower) || /^fee[0-9a-f]:/.test(lower) || /^fef[0-9a-f]:/.test(lower)) return true; // site-local fec0::/10 (RFC 3879)
  if (/^2001:0*db8:/i.test(lower)) return true;              // 2001:db8::/32 documentation (RFC 3849)
  if (/^0*100::/i.test(lower) || /^0064:ff9b:1::/i.test(lower)) return true; // 100::/64 discard-only (RFC 6666)
  if (/^2002:/i.test(lower)) {
    // 6to4 prefix: 2002:WWXX:YYZZ::/48 embeds IPv4 WW.XX.YY.ZZ
    const parts = lower.split(':');
    if (parts.length >= 3 && parts[1] && parts[2]) {
      const p1 = parseInt(parts[1], 16);
      const p2 = parseInt(parts[2], 16);
      if (!Number.isNaN(p1) && !Number.isNaN(p2)) {
        const ip4 = `${(p1 >> 8) & 0xff}.${p1 & 0xff}.${(p2 >> 8) & 0xff}.${p2 & 0xff}`;
        if (isPrivateIPv4(ip4)) return true;
      }
    }
  }
  const mapped = extractIPv4Mapped(lower);
  if (mapped) return isPrivateIPv4(mapped);
  return false;
}

function isPrivateAddress(ip) {
  return ip.includes(':') ? isPrivateIPv6(ip) : isPrivateIPv4(ip);
}

/**
 * Assert that a URL string uses an allowed protocol (http or https only)
 * and — when the hostname is itself a literal IP address, or the plain
 * string "localhost" — does not target a private or loopback address.
 *
 * This is the fast, synchronous check: it catches SSRF attempts that embed
 * a private IP literal directly in the URL (e.g. `http://169.254.169.254/`).
 * It intentionally does NOT resolve hostnames — see `assertResolvedHostSafe`
 * for the DNS-aware check that closes the rebinding gap where a public
 * domain name resolves to a private address.
 *
 * @param {string} url
 * @param {{ allowPrivateHosts?: boolean }} [opts]
 * @throws {Error} if the scheme is not http/https or a literal host is private/loopback.
 */
export function assertHttpUrl(url, opts = {}) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(
      `Rejected non-HTTP URL scheme "${parsed.protocol}" — only http: and https: are allowed.`
    );
  }
  // SECURITY: block private/loopback hostnames to prevent SSRF via redirect.
  // opts.allowPrivateHosts is only intended for test harnesses that spin up
  // localhost servers; never set it in production code paths.
  if (!opts.allowPrivateHosts) {
    const hostname = parsed.hostname.replace(/^\[|\]$/g, '');
    if (
      PRIVATE_HOSTNAME_PATTERNS.some((re) => re.test(hostname)) ||
      isPrivateAddress(hostname)
    ) {
      throw new Error(
        `Rejected private or loopback address "${hostname}" — SSRF prevention.`
      );
    }
  }
}

/**
 * DNS-aware SSRF check. Resolves the URL's hostname and rejects it if ANY
 * returned address is private/loopback/link-local.
 *
 * SECURITY — closes the DNS-rebinding gap: `assertHttpUrl` only inspects the
 * hostname string, so a domain like "attacker-controlled.example" that
 * *resolves* to 127.0.0.1 or the cloud metadata address (169.254.169.254)
 * previously sailed through unblocked, since neither of those private IPs
 * appears in the URL text itself. This function performs the actual DNS
 * lookup and validates the resolved address(es) before the request is made.
 *
 * KNOWN LIMITATION: this check and the subsequent `fetch()` call are not
 * atomic — a DNS record could theoretically change between this lookup and
 * the connection `fetch()` makes internally (classic TOCTOU rebinding).
 * Fully closing that gap requires pinning the connection to the specific IP
 * validated here (e.g. via a custom connection dispatcher), which is out of
 * scope for a zero-dependency library built on the global `fetch`. This
 * lookup still blocks the overwhelmingly common case — a stable hostname
 * that always resolves to an internal address — and meaningfully narrows
 * the attack window for the rebinding case.
 *
 * @param {string} url
 * @param {{ allowPrivateHosts?: boolean }} [opts]
 * @throws {Error} if resolution fails or any resolved address is private/loopback.
 */
export async function assertResolvedHostSafe(url, opts = {}) {
  if (opts.allowPrivateHosts) return;
  const parsed = new URL(url);
  const hostname = parsed.hostname.replace(/^\[|\]$/g, '');

  // Literal IPs and "localhost" are already fully covered by assertHttpUrl;
  // skip the redundant DNS lookup (dns.lookup on a literal IP is a no-op
  // anyway, but avoiding it keeps this fast for the common case).
  if (isPrivateAddress(hostname) || PRIVATE_HOSTNAME_PATTERNS.some((re) => re.test(hostname))) {
    return;
  }

  let addresses;
  try {
    addresses = await dnsLookup(hostname, { all: true, verbatim: true });
  } catch (err) {
    throw new Error(`Could not resolve host "${hostname}": ${err.message}`);
  }

  for (const { address } of addresses) {
    if (isPrivateAddress(address)) {
      throw new Error(
        `Rejected "${hostname}" — resolves to private/loopback address ${address} (SSRF prevention).`
      );
    }
  }
}

/**
 * Read a Response body as text while enforcing `maxBytes` incrementally as
 * bytes arrive, rather than buffering the full body before checking its
 * size. A `content-length` header is checked first as a fast pre-flight
 * rejection, but that header is untrustworthy (absent on chunked responses,
 * or simply lied about by a malicious server) — the byte-counted stream
 * read below is the real enforcement and will abort mid-response the moment
 * the cap is exceeded, regardless of what any header claimed.
 *
 * @param {Response} response
 * @param {number} maxBytes
 * @param {string} urlForError - Included in the thrown error for context.
 * @returns {Promise<string>}
 */
export async function readBodyWithCap(response, maxBytes, urlForError) {
  const reader = response.body?.getReader?.();
  if (!reader) {
    // Fallback for environments where the body isn't a streamable
    // ReadableStream. Still enforced, just not incrementally.
    const text = await response.text();
    if (Buffer.byteLength(text, 'utf8') > maxBytes) {
      throw new Error(`Response body too large (max ${maxBytes} bytes) — ${urlForError}`);
    }
    return text;
  }

  const decoder = new TextDecoder();
  let received = 0;
  let out = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new Error(
        `Response body too large: exceeded ${maxBytes} bytes while streaming — ${urlForError}`
      );
    }
    out += decoder.decode(value, { stream: true });
  }
  out += decoder.decode();
  return out;
}

/**
 * Fetch a URL as text, following redirects manually (up to maxRedirects),
 * with a configurable timeout, a hard 5 MB body cap, conditional GET support
 * (ETag / If-Modified-Since), and automatic retry with exponential backoff on
 * transient failures (429, 503, network errors).
 *
 * Accepts a `userAgent` option or a `headers['user-agent']` override so
 * callers can pass a browser UA string to avoid 403 blocks on feeds that
 * reject bot user-agents.
 *
 * @param {string} url
 * @param {object} [options]
 * @param {number}  [options.timeout=10000]         - Request timeout in milliseconds.
 * @param {number}  [options.maxRedirects=5]        - Maximum redirects to follow.
 * @param {string}  [options.userAgent]             - Override the default User-Agent.
 * @param {Record<string,string>} [options.headers] - Additional request headers.
 *                                                    options.headers['user-agent'] takes
 *                                                    precedence over options.userAgent.
 * @param {number}  [options.retries=2]             - Max retries on 429/5xx/network error.
 * @param {string}  [options.etag]                  - ETag for conditional GET (If-None-Match).
 * @param {string}  [options.lastModified]          - Date string for conditional GET (If-Modified-Since).
 * @returns {Promise<{ text: string, etag: string|null, lastModified: string|null }|null>}
 *   Returns null when the server responds 304 Not Modified (feed unchanged).
 */
export async function fetchTextWithRedirects(url, options = {}) {
  const ssrfOpts = { allowPrivateHosts: Boolean(options._allowPrivateHosts) };
  assertHttpUrl(url, ssrfOpts);
  await assertResolvedHostSafe(url, ssrfOpts);

  const timeout = typeof options.timeout === 'number' && options.timeout > 0
    ? options.timeout
    : 10_000;
  const maxRedirects = typeof options.maxRedirects === 'number' && options.maxRedirects >= 0
    ? options.maxRedirects
    : 5;
  const maxRetries = typeof options.retries === 'number' && options.retries >= 0
    ? Math.min(options.retries, 5)
    : 2;

  // Resolve User-Agent: explicit headers['user-agent'] > options.userAgent > package default.
  const resolvedUA =
    options.headers?.['user-agent'] ??
    options.headers?.['User-Agent'] ??
    options.userAgent ??
    DEFAULT_USER_AGENT;

  const baseHeaders = {
    'user-agent': resolvedUA,
    accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
    ...(options.headers || {})
  };
  // Normalise: remove the original header key so we don't send it twice
  // after the resolved UA has already been folded into baseHeaders.
  delete baseHeaders['User-Agent'];

  // Conditional GET headers — allows servers to respond with 304 Not Modified
  // so callers can skip re-processing an unchanged feed.
  if (options.etag) {
    baseHeaders['if-none-match'] = options.etag;
  }
  if (options.lastModified) {
    baseHeaders['if-modified-since'] = options.lastModified;
  }

  let attempt = 0;

  // Outer retry loop.
  while (true) {
    let currentUrl = url;
    let redirectsFollowed = 0;

    try {
      // Inner redirect-following loop for this attempt.
      while (true) {
        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(new Error('Request timed out')),
          timeout
        );

        let response;
        try {
          response = await fetch(currentUrl, {
            headers: baseHeaders,
            redirect: 'manual',
            signal: controller.signal
          });
        } finally {
          clearTimeout(timeoutId);
        }

        // Handle redirects manually so we can cap the count.
        if (response.status >= 300 && response.status < 400) {
          if (redirectsFollowed >= maxRedirects) {
            throw new Error(`Too many redirects (max ${maxRedirects}) while fetching: ${url}`);
          }
          const location = response.headers.get('location');
          if (!location) {
            throw new Error(`Redirect with no Location header from: ${currentUrl}`);
          }
          currentUrl = new URL(location, currentUrl).href;
          assertHttpUrl(currentUrl, ssrfOpts);
          await assertResolvedHostSafe(currentUrl, ssrfOpts);
          redirectsFollowed += 1;
          continue;
        }

        // 304 Not Modified — feed unchanged since last conditional GET.
        if (response.status === 304) {
          return null;
        }

        // Retry on 429 Too Many Requests and 5xx transient errors.
        if (response.status === 429 || response.status >= 500) {
          if (attempt < maxRetries) {
            // Honour Retry-After header if present (value in seconds).
            const retryAfter = Number(response.headers.get('retry-after'));
            const backoffMs = Number.isFinite(retryAfter) && retryAfter > 0
              ? Math.min(retryAfter * 1000, 60_000)
              : Math.min(1000 * 2 ** attempt, 16_000); // exponential: 1s, 2s, 4s…
            attempt += 1;
            await new Promise((resolve) => setTimeout(resolve, backoffMs));
            break; // break inner loop → retry outer loop
          }
        }

        if (!response.ok) {
          throw new Error(`HTTP ${response.status} ${response.statusText} — ${currentUrl}`);
        }

        // Fast pre-flight rejection when content-length is present and honest.
        // Not relied upon alone — readBodyWithCap enforces the real cap
        // incrementally as bytes stream in, regardless of this header.
        const contentLength = Number(response.headers.get('content-length'));
        if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
          throw new Error(
            `Response too large: ${contentLength} bytes (max ${MAX_BODY_BYTES}) — ${currentUrl}`
          );
        }

        const text = await readBodyWithCap(response, MAX_BODY_BYTES, currentUrl);

        // Return text alongside cache-validator headers so callers can store
        // them and send conditional GETs on the next poll cycle.
        return {
          text,
          etag: response.headers.get('etag') ?? null,
          lastModified: response.headers.get('last-modified') ?? null
        };
      }
    } catch (err) {
      // Retry on network-level errors (DNS failure, connection reset, timeout).
      const isNetworkError =
        err.name === 'AbortError' ||
        err.name === 'TypeError' ||
        err.message === 'Request timed out';
      if (isNetworkError && attempt < maxRetries) {
        const backoffMs = Math.min(1000 * 2 ** attempt, 16_000);
        attempt += 1;
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        continue;
      }
      throw err;
    }
  }
}
