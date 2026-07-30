import { parseXml } from './parser.js';

/**
 * Parse an OPML XML string into structured feed outlines.
 *
 * @param {string} xml - Raw OPML XML text.
 * @returns {{ title: string, feeds: Array<{ title: string, xmlUrl: string, htmlUrl?: string, text?: string, category?: string }> }}
 */
export function parseOpml(xml) {
  if (typeof xml !== 'string' || !xml.trim()) {
    throw new TypeError('parseOpml requires a non-empty string XML argument');
  }

  const parsed = parseXml(xml);
  const opmlNode = parsed?.opml || parsed;
  const headNode = opmlNode?.head || {};
  const bodyNode = opmlNode?.body || {};

  const title = typeof headNode.title === 'string' ? headNode.title.trim() : '';

  const feeds = [];

  function processOutlineNode(node, currentCategory = '') {
    if (!node || typeof node !== 'object') return;

    if (Array.isArray(node)) {
      for (const item of node) {
        processOutlineNode(item, currentCategory);
      }
      return;
    }

    const xmlUrl = node['@_xmlUrl'] || node['@_xmlurl'] || node['@_url'];
    const text = node['@_text'] || node['@_title'] || '';
    const htmlUrl = node['@_htmlUrl'] || node['@_htmlurl'];
    const outlineTitle = node['@_title'] || node['@_text'] || '';

    const category = currentCategory || node['@_category'] || '';

    if (xmlUrl) {
      feeds.push({
        title: outlineTitle.trim(),
        xmlUrl: xmlUrl.trim(),
        ...(htmlUrl ? { htmlUrl: htmlUrl.trim() } : {}),
        ...(text ? { text: text.trim() } : {}),
        ...(category ? { category: category.trim() } : {})
      });
    }

    // Process nested outline tags (folders / categories)
    if (node.outline) {
      const categoryName = !xmlUrl && text ? text.trim() : category;
      processOutlineNode(node.outline, categoryName);
    }
  }

  if (bodyNode.outline) {
    processOutlineNode(bodyNode.outline);
  }

  return { title, feeds };
}
