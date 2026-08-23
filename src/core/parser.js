/**
 * findTagClose — quote-aware scan for the closing '>' of an XML tag.
 *
 * CORRECTNESS: xml.indexOf('>', from) is NOT safe for attribute parsing
 * because a quoted attribute value may legally contain an unescaped '>'
 * (e.g. title="A > B article"). A naive indexOf fires on the first '>' it
 * finds, which may be inside a quoted value, splitting the tag string and
 * silently corrupting every node that follows in the same parent element.
 *
 * This helper tracks quote state character-by-character so it only returns
 * a position at a true tag-close '>' that is outside any quoted attribute.
 *
 * @param {string} xml  - Full XML source string.
 * @param {number} from - Index to start scanning from (one past the opening '<').
 * @returns {number} Index of the closing '>', or -1 if not found.
 */
function findTagClose(xml, from) {
  let q = null;
  for (let i = from; i < xml.length; i++) {
    const c = xml[i];
    if (q) {
      if (c === q) q = null;
    } else if (c === '"' || c === "'") {
      q = c;
    } else if (c === '>') {
      return i;
    }
  }
  return -1;
}

const MAX_XML_DEPTH = 128;
const FORBIDDEN_OBJECT_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function sanitizeNodeKey(key) {
  if (FORBIDDEN_OBJECT_KEYS.has(key)) return `_${key}`;
  return key;
}

function safeCodePoint(num) {
  return Number.isInteger(num) && num >= 0 && num <= 0x10ffff
    ? String.fromCodePoint(num)
    : '';
}

export function parseXml(xml) {
  let index = 0;

  function unescapeEntities(text) {
    return text
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => safeCodePoint(parseInt(hex, 16)))
      .replace(/&#([0-9]+);/g, (_, dec) => safeCodePoint(parseInt(dec, 10)))
      .replace(/&amp;/g, '&');
  }

  const stack = [{ '#name': 'root', '#children': [] }];

  while (index < xml.length) {
    const nextOpen = xml.indexOf('<', index);
    if (nextOpen === -1) {
      const text = xml.slice(index).trim();
      if (text) {
        const current = stack[stack.length - 1];
        if (current) current['#text'] = (current['#text'] || '') + unescapeEntities(text);
      }
      break;
    }

    if (nextOpen > index) {
      const text = xml.slice(index, nextOpen).trim();
      if (text) {
        const current = stack[stack.length - 1];
        if (current) current['#text'] = (current['#text'] || '') + unescapeEntities(text);
      }
    }

    index = nextOpen;

    // XML comments: <!-- ... -->
    if (xml.startsWith('<!--', index)) {
      const closeComment = xml.indexOf('-->', index + 4);
      index = closeComment === -1 ? xml.length : closeComment + 3;
      continue;
    }

    // CDATA sections: <![CDATA[ ... ]]>
    if (xml.startsWith('<![CDATA[', index)) {
      const closeCdata = xml.indexOf(']]>', index + 9);
      const text = closeCdata === -1 ? xml.slice(index + 9) : xml.slice(index + 9, closeCdata);
      const current = stack[stack.length - 1];
      if (current) {
        current['#text'] = (current['#text'] || '') + text;
      }
      index = closeCdata === -1 ? xml.length : closeCdata + 3;
      continue;
    }

    // Processing instructions: <?...?>
    if (xml.startsWith('<?', index)) {
      const closeProc = xml.indexOf('?>', index + 2);
      index = closeProc === -1 ? xml.length : closeProc + 2;
      continue;
    }

    // Use quote-aware scan so a '>' inside a quoted attribute value does not
    // prematurely close the tag and corrupt the node tree.
    const closeTagBracket = findTagClose(xml, index + 1);
    if (closeTagBracket === -1) {
      index = xml.length;
      break;
    }

    const tagStr = xml.slice(index + 1, closeTagBracket);
    index = closeTagBracket + 1;

    if (tagStr.startsWith('/')) {
      const name = tagStr.slice(1).trim();
      let found = -1;
      for (let i = stack.length - 1; i >= 1; i--) {
        if (stack[i]['#name'] === name) {
          found = i;
          break;
        }
      }
      if (found !== -1) {
        while (stack.length > found) {
          const closed = stack.pop();
          stack[stack.length - 1]['#children'].push(closed);
        }
      }
    } else {
      const isSelfClose = tagStr.endsWith('/');
      const content = isSelfClose ? tagStr.slice(0, -1) : tagStr;

      const spaceIndex = content.search(/\s/);
      const name = spaceIndex === -1 ? content : content.slice(0, spaceIndex);
      const attrStr = spaceIndex === -1 ? '' : content.slice(spaceIndex);

      const node = { '#name': name, '#children': [] };

      // CORRECTNESS: match both quoted and unquoted attribute values.
      const attrRegex =
        /([a-zA-Z0-9_:-]+)="([^"]*)"|([a-zA-Z0-9_:-]+)='([^']*)'|([a-zA-Z0-9_:-]+)=([^\s>"']+)|([a-zA-Z0-9_:-]+)(?=[\s>/]|$)/g;
      let attrMatch;
      while ((attrMatch = attrRegex.exec(attrStr)) !== null) {
        if (attrMatch[1] !== undefined) {
          // double-quoted
          node[`@_${attrMatch[1]}`] = unescapeEntities(attrMatch[2]);
        } else if (attrMatch[3] !== undefined) {
          // single-quoted
          node[`@_${attrMatch[3]}`] = unescapeEntities(attrMatch[4]);
        } else if (attrMatch[5] !== undefined) {
          // unquoted value
          node[`@_${attrMatch[5]}`] = unescapeEntities(attrMatch[6]);
        } else if (attrMatch[7] !== undefined) {
          // boolean flag — value is empty string
          node[`@_${attrMatch[7]}`] = '';
        }
      }

      if (isSelfClose) {
        stack[stack.length - 1]['#children'].push(node);
      } else {
        if (stack.length >= MAX_XML_DEPTH) {
          throw new Error(`XML exceeded maximum nesting depth of ${MAX_XML_DEPTH}`);
        }
        stack.push(node);
      }
    }
  }

  function toJsObject(node) {
    const attrKeys = Object.keys(node).filter(k => k.startsWith('@_'));
    if (node['#children'].length === 0) {
      if (attrKeys.length === 0 && '#text' in node) {
        return node['#text'];
      }
      if (attrKeys.length === 0) {
        return '';
      }
      const res = {};
      if ('#text' in node) res['#text'] = node['#text'];
      for (const k of attrKeys) {
        const safeAttrKey = `@_${sanitizeNodeKey(k.slice(2))}`;
        res[safeAttrKey] = node[k];
      }
      return res;
    }

    const res = {};
    if ('#text' in node) res['#text'] = node['#text'];
    for (const k of Object.keys(node)) {
      if (k.startsWith('@_')) {
        const safeAttrKey = `@_${sanitizeNodeKey(k.slice(2))}`;
        res[safeAttrKey] = node[k];
      }
    }

    for (const child of node['#children']) {
      const rawName = child['#name'];
      const name = sanitizeNodeKey(rawName);
      const val = toJsObject(child);
      if (Object.hasOwn(res, name)) {
        if (Array.isArray(res[name])) {
          res[name].push(val);
        } else {
          res[name] = [res[name], val];
        }
      } else {
        res[name] = val;
      }
    }
    return res;
  }

  return toJsObject(stack[0]);
}

function asArray(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

/**
 * Strip HTML tags from a string to produce a plain-text snippet.
 *
 * Removal is done in two passes:
 *
 * Pass 1 — block removal: entire tag + content is removed for executable
 * and embeddable elements: <script>, <style>, <iframe>, <object>, <embed>,
 * <form>. This prevents XSS vectors where a script payload or CSS expression
 * inside a block-level element survives tag stripping and reaches a renderer.
 *
 * Pass 2 — tag removal: all remaining tags are stripped with <[^>]+> so
 * that inline event handlers (onerror=, onclick=, etc.) are neutralised by
 * removing the surrounding tag entirely.
 *
 * Additional normalisation:
 *   - &nbsp; is replaced with a regular space before whitespace collapse
 *   - Consecutive whitespace is collapsed to a single space
 *   - Leading/trailing whitespace is trimmed
 *
 * @param {string} [html=''] - Raw HTML string to convert to plain text.
 * @returns {string} Plain-text representation with all markup removed.
 */
export function stripHtml(html = '') {
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
 * Attempt to normalise a raw date string to ISO 8601.
 * Returns null if parsing fails or if input is empty.
 * Callers expect isoDate to be either ISO 8601 or null.
 */
function safeIsoDate(raw) {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function textValue(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return textValue(value[0]);
  if (typeof value === 'object') {
    if ('#text' in value) return textValue(value['#text']);
    if ('#cdata' in value) return textValue(value['#cdata']);
    if ('_text' in value) return textValue(value._text);
    const first = Object.values(value)[0];
    return textValue(first);
  }
  return '';
}

function extractCustomValue(source, key, keepArray = false) {
  const value = source?.[key];
  if (value == null) return keepArray ? [] : undefined;
  if (keepArray) return asArray(value).map(textValue);
  return textValue(asArray(value)[0]);
}

function applyCustomFields(target, source, fields = []) {
  for (const field of fields) {
    if (typeof field === 'string') {
      const value = extractCustomValue(source, field);
      if (value !== undefined) target[field] = value;
      continue;
    }

    const [fromField, toField, flags = {}] = field;
    const value = extractCustomValue(source, fromField, Boolean(flags.keepArray));
    if (value !== undefined) {
      target[toField] = value;
      if (flags.includeSnippet) {
        target[`${toField}Snippet`] = stripHtml(Array.isArray(value) ? value.join(' ') : value);
      }
    }
  }
}

function getLinkValue(node) {
  if (node == null) return '';
  if (Array.isArray(node)) return getLinkValue(node[0]);
  if (typeof node === 'string') return node;
  if (typeof node !== 'object') return textValue(node);
  if ('@_href' in node) return textValue(node['@_href']);
  if ('href' in node) return textValue(node.href);
  return textValue(node);
}

import { isJsonFeed, parseJsonFeed } from './json-feed.js';

function extractEnclosure(itemNode) {
  if (itemNode.enclosure) {
    const enc = Array.isArray(itemNode.enclosure) ? itemNode.enclosure[0] : itemNode.enclosure;
    if (typeof enc === 'object' && enc !== null) {
      return {
        url: enc['@_url'] || enc.url || '',
        length: enc['@_length'] || enc.length,
        type: enc['@_type'] || enc.type
      };
    }
  }
  if (itemNode.link && typeof itemNode.link === 'object') {
    const links = Array.isArray(itemNode.link) ? itemNode.link : [itemNode.link];
    const encLink = links.find((l) => l['@_rel'] === 'enclosure');
    if (encLink) {
      return {
        url: encLink['@_href'] || encLink.href || '',
        length: encLink['@_length'] || encLink.length,
        type: encLink['@_type'] || encLink.type
      };
    }
  }
  return undefined;
}

function extractMedia(itemNode) {
  const thumbNode = itemNode['media:thumbnail'] || itemNode['media:content'] || itemNode['media:group']?.['media:thumbnail'];
  if (thumbNode) {
    const thumb = Array.isArray(thumbNode) ? thumbNode[0] : thumbNode;
    const url = typeof thumb === 'object' ? (thumb['@_url'] || thumb.url || '') : textValue(thumb);
    if (url) {
      return {
        thumbnail: url,
        ...(typeof thumb === 'object' && thumb['@_medium'] ? { medium: thumb['@_medium'] } : {})
      };
    }
  }
  return undefined;
}

function extractItunes(itemNode) {
  const itunes = {};
  if (itemNode['itunes:duration']) itunes.duration = textValue(itemNode['itunes:duration']);
  if (itemNode['itunes:episode']) itunes.episode = textValue(itemNode['itunes:episode']);
  if (itemNode['itunes:author']) itunes.author = textValue(itemNode['itunes:author']);
  if (itemNode['itunes:image']) {
    const img = itemNode['itunes:image'];
    itunes.image = typeof img === 'object' ? (img['@_href'] || img.href || '') : textValue(img);
  }
  if (itemNode['itunes:summary']) itunes.summary = textValue(itemNode['itunes:summary']);
  return Object.keys(itunes).length > 0 ? itunes : undefined;
}

function normalizeItem(itemNode, options) {
  const rawDate = textValue(itemNode.pubDate || itemNode.updated || itemNode.published);

  const normalized = {
    title: textValue(itemNode.title),
    link: getLinkValue(itemNode.link),
    pubDate: rawDate,
    isoDate: safeIsoDate(rawDate),
    guid: textValue(itemNode.guid || itemNode.id),
    content: textValue(itemNode['content:encoded'] || itemNode.content || itemNode.summary || itemNode.description),
    contentSnippet: stripHtml(textValue(itemNode.description || itemNode.summary || itemNode.content || itemNode['content:encoded'])),
    categories: asArray(itemNode.category ?? itemNode.categories).map(textValue).filter(Boolean)
  };

  const enclosure = extractEnclosure(itemNode);
  if (enclosure) normalized.enclosure = enclosure;

  const media = extractMedia(itemNode);
  if (media) normalized.media = media;

  const itunes = extractItunes(itemNode);
  if (itunes) normalized.itunes = itunes;

  if (options.normalize === false) {
    Object.assign(normalized, itemNode);
  }

  applyCustomFields(normalized, itemNode, options.customFields?.item || []);

  if (!normalized.creator) {
    const creator = itemNode.creator || itemNode.author || itemNode['dc:creator'] || itunes?.author;
    if (creator) normalized.creator = textValue(creator);
  }

  return normalized;
}

function normalizeFeed(feedNode, items, options) {
  const feed = {
    title: textValue(feedNode.title),
    description: textValue(feedNode.description || feedNode.subtitle),
    link: getLinkValue(feedNode.link),
    feedUrl: textValue(feedNode.feedUrl),
    items
  };

  applyCustomFields(feed, feedNode, options.customFields?.feed || []);
  return feed;
}

function pickFeedNode(parsed) {
  if (parsed?.rss?.channel) return parsed.rss.channel;
  if (parsed?.feed) return parsed.feed;
  if (parsed?.channel) return parsed.channel;
  return parsed;
}

function getFeedAndItems(parsed) {
  const feedContainer = pickFeedNode(parsed);
  const feedNode = Array.isArray(feedContainer) ? feedContainer[0] : feedContainer;
  const rawItems = asArray(feedNode?.item || feedNode?.entry);
  return { feedNode: feedNode || {}, rawItems };
}

/**
 * Parse a raw RSS/Atom XML or JSON Feed string into a normalised feed object.
 * Synchronous — XML parsing is CPU-bound; async wrapper was unnecessary overhead.
 */
export function parseFeedXml(xml, options = {}) {
  if (isJsonFeed(xml)) {
    return parseJsonFeed(xml, options);
  }
  const parsed = parseXml(xml);
  const { feedNode, rawItems } = getFeedAndItems(parsed);
  const items = rawItems.map((itemNode) => normalizeItem(itemNode, options));
  return normalizeFeed(feedNode, items, options);
}

export { parseFeedXml as parseFeedString };
