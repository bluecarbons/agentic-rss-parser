const DEFAULT_USER_AGENT = 'agentic-rss-parser/1.0.1';

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

      return await response.text();
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
