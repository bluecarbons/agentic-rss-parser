import pkg from '../../package.json' with { type: 'json' };

// Default User-Agent string. Callers can override via options.userAgent or options.headers['user-agent'].
const DEFAULT_USER_AGENT = `agentic-rss-parser/${pkg.version}`;

// Hard cap on response body size (5 MB). Prevents OOM on unexpectedly large
// or malicious feed responses.
const MAX_BODY_BYTES = 5 * 1024 * 1024;

/**
 * Private / loopback address ranges that must not be reachable via feed or
 * article fetches. Blocking these prevents SSRF attacks where a crafted feed
 * redirect targets an internal service (AWS metadata at 169.254.169.254,
 * Redis at 127.0.0.1:6379, or any RFC-1918 host on the local network).
 *
 * IPv6 loopback (::1) and ULA ranges (fc00::/7, fd00::/8) are also blocked.
 */
const PRIVATE_HOSTNAME_PATTERNS = [
  /^localhost$/i,
  /^127\./,                                       // 127.0.0.0/8 loopback
  /^10\./,                                        // 10.0.0.0/8 private
  /^192\.168\./,                                  // 192.168.0.0/16 private
  /^172\.(1[6-9]|2\d|3[01])\./,                  // 172.16.0.0/12 private
  /^169\.254\./,                                  // 169.254.0.0/16 link-local / AWS metadata
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,   // 100.64.0.0/10 carrier-grade NAT
  /^::1$/,                                        // IPv6 loopback
  /^\[::1\]$/,                                    // IPv6 loopback (bracket form)
  /^fc[0-9a-f]{2}:/i,                            // IPv6 ULA fc00::/7
  /^fd[0-9a-f]{2}:/i,                            // IPv6 ULA fd00::/8
];

/**
 * Assert that a URL string uses an allowed protocol (http or https only)
 * and does not target a private or loopback address.
 *
 * Rejects file://, javascript://, ftp://, and any other scheme to prevent
 * SSRF and local file inclusion attacks. Also rejects requests to RFC-1918,
 * loopback, link-local, and carrier-grade NAT ranges to prevent redirect-based
 * SSRF (e.g. a feed that redirects to http://169.254.169.254/latest/meta-data).
 *
 * @param {string} url
 * @param {{ allowPrivateHosts?: boolean }} [opts]
 * @throws {Error} if the scheme is not http/https or the host is private/loopback.
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
    const hostname = parsed.hostname;
    if (PRIVATE_HOSTNAME_PATTERNS.some((re) => re.test(hostname))) {
      throw new Error(
        `Rejected private or loopback address "${hostname}" — SSRF prevention.`
      );
    }
  }
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
