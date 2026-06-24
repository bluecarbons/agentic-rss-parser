export function parseXml(xml) {
  let index = 0;

  function unescapeEntities(text) {
    return text
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
      .replace(/&#([0-9]+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
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

    const closeTagBracket = xml.indexOf('>', index);
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

      const attrRegex = /([a-zA-Z0-9_:-]+)="([^"]*)"|([a-zA-Z0-9_:-]+)='([^']*)'/g;
      let attrMatch;
      while ((attrMatch = attrRegex.exec(attrStr)) !== null) {
        const key = attrMatch[1] || attrMatch[3];
        const rawVal = attrMatch[2] !== undefined ? attrMatch[2] : attrMatch[4];
        node[`@_${key}`] = unescapeEntities(rawVal);
      }

      if (isSelfClose) {
        stack[stack.length - 1]['#children'].push(node);
      } else {
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
      for (const k of attrKeys) res[k] = node[k];
      return res;
    }

    const res = {};
    if ('#text' in node) res['#text'] = node['#text'];
    for (const k of Object.keys(node)) {
      if (k.startsWith('@_')) res[k] = node[k];
    }

    for (const child of node['#children']) {
      const name = child['#name'];
      const val = toJsObject(child);
      if (name in res) {
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
 * SECURITY: removes entire contents of executable/embeddable tag blocks
 * (script, style, iframe, object, embed, form) to prevent XSS vectors
 * in any downstream context that renders contentSnippet as HTML.
 * Inline event handlers (onerror=, onclick=, etc.) are neutralised by
 * removing all remaining tags after the block removal pass.
 */
function stripHtml(html = '') {
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
 * Returns the original string if Date parsing fails, null if input is empty.
 * This prevents raw pubDate strings like "Mon, 23 Jun 2026 12:00:00 +0000"
 * from leaking into isoDate — callers expect ISO 8601 or null.
 */
function safeIsoDate(raw) {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? raw : d.toISOString();
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

function normalizeItem(itemNode, options) {
  const rawDate = textValue(itemNode.pubDate || itemNode.updated || itemNode.published);

  const normalized = {
    title: textValue(itemNode.title),
    link: getLinkValue(itemNode.link),
    pubDate: rawDate,
    // CORRECTNESS: isoDate must be an ISO 8601 string (or null), not the raw
    // RSS date string. safeIsoDate() parses via Date() and falls back to the
    // raw string only when parsing fails (non-standard feed date formats).
    isoDate: safeIsoDate(rawDate),
    guid: textValue(itemNode.guid || itemNode.id),
    content: textValue(itemNode['content:encoded'] || itemNode.content || itemNode.summary || itemNode.description),
    // COHERENCE: contentSnippet is set once here from the richest available
    // source and is NOT overwritten below. The previous code set it here
    // then silently clobbered it 10 lines later.
    contentSnippet: stripHtml(textValue(itemNode.description || itemNode.summary || itemNode.content || itemNode['content:encoded'])),
    categories: asArray(itemNode.category ?? itemNode.categories).map(textValue).filter(Boolean)
  };

  if (options.normalize === false) {
    Object.assign(normalized, itemNode);
  }

  applyCustomFields(normalized, itemNode, options.customFields?.item || []);

  if (!normalized.creator) {
    const creator = itemNode.creator || itemNode.author || itemNode['dc:creator'];
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
 * Parse a raw RSS/Atom XML string into a normalised feed object.
 * Synchronous — XML parsing is CPU-bound; async wrapper was unnecessary overhead.
 */
export function parseFeedXml(xml, options = {}) {
  const parsed = parseXml(xml);
  const { feedNode, rawItems } = getFeedAndItems(parsed);
  const items = rawItems.map((itemNode) => normalizeItem(itemNode, options));
  return normalizeFeed(feedNode, items, options);
}
