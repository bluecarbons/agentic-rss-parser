import { stripHtml } from './parser.js';

/**
 * Check if a string or object represents a JSON Feed (v1 or v1.1).
 *
 * @param {string|object} content
 * @returns {boolean}
 */
export function isJsonFeed(content) {
  if (typeof content === 'object' && content !== null) {
    return typeof content.version === 'string' && content.version.startsWith('https://jsonfeed.org/version/');
  }
  if (typeof content === 'string') {
    const trimmed = content.trim();
    if (trimmed.startsWith('{') && trimmed.includes('https://jsonfeed.org/version/')) {
      try {
        const parsed = JSON.parse(trimmed);
        return typeof parsed?.version === 'string' && parsed.version.startsWith('https://jsonfeed.org/version/');
      } catch {
        return false;
      }
    }
  }
  return false;
}

/**
 * Parse and normalize a JSON Feed object or JSON string into the standardized Feed object.
 *
 * @param {string|object} input
 * @param {object} [options]
 * @returns {object} Normalized Feed
 */
export function parseJsonFeed(input, options = {}) {
  const data = typeof input === 'string' ? JSON.parse(input) : input;
  if (!data || typeof data !== 'object') {
    throw new TypeError('Invalid JSON Feed: root must be an object');
  }

  const rawItems = Array.isArray(data.items) ? data.items : [];
  const items = rawItems.map((item) => normalizeJsonFeedItem(item, options));

  return {
    title: String(data.title || '').trim(),
    description: String(data.description || data.home_page_url || '').trim(),
    link: data.home_page_url || data.feed_url || '',
    feedUrl: data.feed_url || '',
    items
  };
}

function normalizeJsonFeedItem(item, options = {}) {
  const content = item.content_html || item.content_text || item.summary || '';
  const contentSnippet = stripHtml(item.summary || item.content_text || item.content_html || '');
  const rawDate = item.date_published || item.date_modified || null;
  const isoDate = rawDate ? safeIsoDate(rawDate) : null;

  const normalized = {
    title: String(item.title || '').trim() || 'Untitled item',
    link: item.url || item.external_url || item.id || '',
    pubDate: rawDate,
    isoDate,
    guid: String(item.id || item.url || ''),
    content,
    contentSnippet,
    categories: Array.isArray(item.tags) ? item.tags.map(String).filter(Boolean) : []
  };

  if (item.authors && Array.isArray(item.authors) && item.authors.length > 0) {
    normalized.creator = item.authors.map((a) => a.name || a).join(', ');
  } else if (item.author?.name) {
    normalized.creator = item.author.name;
  }

  if (Array.isArray(item.attachments) && item.attachments.length > 0) {
    const primary = item.attachments[0];
    normalized.enclosure = {
      url: primary.url || '',
      type: primary.mime_type || '',
      length: primary.size_in_bytes ? String(primary.size_in_bytes) : undefined
    };
  }

  if (item.image || item.banner_image) {
    normalized.media = {
      thumbnail: item.image || item.banner_image
    };
  }

  return normalized;
}

function safeIsoDate(raw) {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
