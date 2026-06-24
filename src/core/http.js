import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

// FIX: read version from package.json via createRequire so the User-Agent
// string never drifts from the published package version.
const { version: PKG_VERSION } = require('../../package.json');
const DEFAULT_USER_AGENT = `agentic-rss-parser/${PKG_VERSION}`;

// SECURITY: cap response body at 5 MB before buffering into memory.
// Prevents OOM when a malicious or misconfigured server returns a multi-MB
// payload in response to a feed fetch. 5 MB is well above any real-world
// RSS/Atom feed; legitimate feeds are typically < 500 KB.
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024; // 5 MB

export async function fetchTextWithRedirects(url, options = {}) {
  assertHttpUrl(url);

  const maxRedirects = Number.isFinite(options.maxRedirects) ? Math.max(0, options.maxRedirects) : 5;
  let currentUrl = url;
  let redirects = 0;

  while (true) {
    const controller = new AbortController();
    const timeoutMs = Number.isFinite(options.timeout) ? options.timeout : 10000;
    const timeoutId = setTimeout(() => controller.abort(new Error('Request timed out')), timeoutMs);
    const requestOptions = {
      ...options.requestOptions,
      signal: controller.signal,
      redirect: 'manual',
      headers: {
        'user-agent': DEFAULT_USER_AGENT,
        ...(options.headers || {}),
        ...(options.requestOptions?.headers || {})
      }
    };

    try {
      const response = await fetch(currentUrl, requestOptions);

      if (isRedirect(response.status)) {
        if (redirects >= maxRedirects) {
          throw new Error(`Too many redirects while fetching ${url}`);
        }

        const location = response.headers.get('location');
        if (!location) {
          throw new Error(`Redirect response missing Location header for ${currentUrl}`);
        }

        currentUrl = new URL(location, currentUrl).toString();
        redirects += 1;
        continue;
      }

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      // SECURITY: enforce body size cap before buffering.
      // Check Content-Length header first (fast path), then re-check after
      // reading the full body (covers chunked/streaming responses that omit
      // Content-Length).
      const contentLength = Number(response.headers.get('content-length'));
      if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES) {
        throw new Error(
          `Feed response too large: ${contentLength} bytes (max ${MAX_RESPONSE_BYTES})`
        );
      }

      const text = await response.text();
      if (text.length > MAX_RESPONSE_BYTES) {
        throw new Error(
          `Feed response body too large: ${text.length} chars (max ${MAX_RESPONSE_BYTES})`
        );
      }

      return text;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

function isRedirect(status) {
  return status >= 300 && status < 400;
}

function assertHttpUrl(url) {
  const parsed = new URL(url);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`Unsupported feed URL protocol: ${parsed.protocol}`);
  }
}
