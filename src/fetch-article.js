import { fetchTextWithRedirects } from './core/http.js';

const MAX_SNIPPET_CHARS = 1200;

/**
 * Strip HTML tags from a string to produce a plain-text snippet.
 *
 * SECURITY — XSS mitigation: removes entire contents of executable and
 * embeddable tag blocks before stripping remaining tags. This matches the
 * stripping applied by core/parser.js so both code paths produce equivalently
 * safe output. Previously this function only stripped <script> and <style>,
 * leaving <iframe>, <object>, and <embed> intact — a potential XSS vector if
 * the result was rendered as HTML by a downstream consumer.
 */
function stripHtml(html) {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, ' ')
    .replace(/<object[\s\S]*?<\/object>/gi, ' ')
    .replace(/<embed[\s\S]*?<\/embed>/gi, ' ')
    .replace(/<form[\s\S]*?<\/form>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Fetch a remote article URL and return a plain-text snippet.
 *
 * Delegates to fetchTextWithRedirects so all requests share the same
 * safety guarantees: 10 s timeout, max-5-redirect cap, http/https
 * protocol enforcement, and a consistent user-agent.
 *
 * @param {string} url - The article URL to fetch.
 * @returns {Promise<string>} Plain-text snippet, capped at MAX_SNIPPET_CHARS.
 */
export async function fetchFullArticle(url) {
  const result = await fetchTextWithRedirects(url, {
    timeout: 10000,
    maxRedirects: 5
  });

  // fetchTextWithRedirects returns null on 304 Not Modified.
  if (result === null) return '';
  const body = result.text;

  const plainText = body.trimStart().startsWith('<')
    ? stripHtml(body)
    : body.replace(/\s+/g, ' ').trim();

  return plainText.slice(0, MAX_SNIPPET_CHARS);
}
