import { XMLParser } from 'fast-xml-parser';

function asArray(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function stripHtml(html = '') {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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
  const normalized = {
    title: textValue(itemNode.title),
    link: getLinkValue(itemNode.link),
    pubDate: textValue(itemNode.pubDate || itemNode.updated || itemNode.published),
    isoDate: textValue(itemNode.pubDate || itemNode.updated || itemNode.published),
    guid: textValue(itemNode.guid || itemNode.id),
    content: textValue(itemNode['content:encoded'] || itemNode.content || itemNode.summary || itemNode.description),
    contentSnippet: stripHtml(textValue(itemNode.description || itemNode.summary || itemNode.content || itemNode['content:encoded'])),
    categories: asArray(itemNode.category ?? itemNode.categories).map(textValue).filter(Boolean)
  };

  if (!options.normalize) {
    Object.assign(normalized, itemNode);
  }

  applyCustomFields(normalized, itemNode, options.customFields?.item || []);

  if (!normalized.creator) {
    const creator = itemNode.creator || itemNode.author || itemNode['dc:creator'];
    if (creator) normalized.creator = textValue(creator);
  }

  const contentSnippet = normalized.contentSnippet || stripHtml(normalized.content || '');
  normalized.contentSnippet = contentSnippet;

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

export async function parseFeedXml(xml, options = {}) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    cdataPropName: '#cdata',
    trimValues: true,
    allowBooleanAttributes: true,
    parseTagValue: false,
    parseAttributeValue: false,
    removeNSPrefix: false,
    ...options.xml2js
  });

  const parsed = parser.parse(xml);
  const { feedNode, rawItems } = getFeedAndItems(parsed);
  const items = rawItems.map((itemNode) => normalizeItem(itemNode, options));
  return normalizeFeed(feedNode, items, options);
}
