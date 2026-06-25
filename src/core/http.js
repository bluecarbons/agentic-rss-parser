import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const { version: PKG_VERSION } = require(join(dirname(fileURLToPath(import.meta.url)), '../../package.json'));

// Default User-Agent string. Callers can override via options.userAgent or options.headers['user-agent'].
const DEFAULT_USER_AGENT = `agentic-rss-parser/${PKG_VERSION}`;

// Hard cap on response body size (5 MB). Prevents OOM on unexpectedly large
// or malicious feed responses.
const MAX_BODY_BYTES = 5 * 1024 * 1024;

/**
 * Assert that a URL string uses an allowed protocol (http or https only).
 * Rejects file://, javascript://, ftp://, and any other scheme to prevent
 * SSRF and local file inclusion attacks.
 *
 * @param {string} url
 * @throws {Error} if the scheme is not http or https.
 */
export function assertHttpUrl(url) {
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
}

/**
 * Fetch a URL as text, following redirects manually (up to maxRedirects),
 * with a configurable timeout and a hard 5 MB body cap.
 *
 * Accepts a `userAgent` option or a `headers['user-agent']` override so
 * callers can pass a browser UA string to avoid 403 blocks on feeds that
 * reject bot user-agents.
 *
 * @param {string} url
 * @param {object} [options]
 * @param {number}  [options.timeout=10000]     - Request timeout in milliseconds.
 * @param {number}  [options.maxRedirects=5]    - Maximum redirects to follow.
 * @param {string}  [options.userAgent]         - Override the default User-Agent.
 * @param {Record<string,string>} [options.headers] - Additional request headers.
 *                                                    options.headers['user-agent'] takes
 *                                                    precedence over options.userAgent.
 * @returns {Promise<string>}
 */
export async function fetchTextWithRedirects(url, options = {}) {
  assertHttpUrl(url);

  const timeout = typeof options.timeout === 'number' && options.timeout > 0
    ? options.timeout
    : 10_000;
  const maxRedirects = typeof options.maxRedirects === 'number' && options.maxRedirects >= 0
    ? options.maxRedirects
    : 5;

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

  let currentUrl = url;
  let redirectsFollowed = 0;

  while (true) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(new Error('Request timed out')), timeout);

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
      assertHttpUrl(currentUrl);
      redirectsFollowed += 1;
      continue;
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText} — ${currentUrl}`);
    }

    // Guard against unexpectedly large responses before buffering.
    const contentLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
      throw new Error(
        `Response too large: ${contentLength} bytes (max ${MAX_BODY_BYTES}) — ${currentUrl}`
      );
    }

    const text = await response.text();
    if (text.length > MAX_BODY_BYTES) {
      throw new Error(
        `Response body too large: ${text.length} chars (max ${MAX_BODY_BYTES}) — ${currentUrl}`
      );
    }

    return text;
  }
}
