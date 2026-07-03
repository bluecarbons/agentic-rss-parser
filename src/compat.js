import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { readFile } from 'node:fs/promises';
import { runAgenticParser } from './parser.js';
import { parseFeedXml } from './core/parser.js';
import { fetchTextWithRedirects } from './core/http.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(__dirname, '..');
const CWD = process.cwd();
const DEFAULT_DB_PATH =
  CWD === PACKAGE_ROOT || CWD.startsWith(PACKAGE_ROOT + '/')
    ? join(PACKAGE_ROOT, 'data', 'rss-agent.db')
    : join(CWD, 'data', 'rss-agent.db');

const DEFAULT_OPTIONS = {
  normalize: true,
  customFields: { feed: [], item: [] },
  headers: undefined,
  timeout: 10000,
  maxRedirects: 5,
  requestOptions: {}
};

function assertFeedUrl(url) {
  if (typeof url !== 'string' || !url.trim()) {
    throw new TypeError('ParserCompat.parseURL() requires a non-empty string URL');
  }
}

function assertLocalFeedPath(filePath) {
  if (typeof filePath !== 'string' || !filePath.trim()) {
    throw new TypeError('ParserCompat.parseFile() requires a non-empty string path');
  }
  if (filePath.includes('://')) {
    throw new TypeError('ParserCompat.parseFile() only accepts local filesystem paths');
  }
  if (filePath.includes('\0')) {
    throw new TypeError('ParserCompat.parseFile() path contains invalid null bytes');
  }
}

function normalizeFeedUrls(urls) {
  const list = Array.isArray(urls) ? urls : [urls];
  return list.map((url) => {
    assertFeedUrl(url);
    return url.trim();
  });
}

function mergeOptions(options = {}) {
  return {
    ...DEFAULT_OPTIONS,
    ...options,
    customFields: {
      feed: [
        ...(DEFAULT_OPTIONS.customFields.feed || []),
        ...(options.customFields?.feed || [])
      ],
      item: [
        ...(DEFAULT_OPTIONS.customFields.item || []),
        ...(options.customFields?.item || [])
      ]
    },
    requestOptions: {
      ...DEFAULT_OPTIONS.requestOptions,
      ...(options.requestOptions || {})
    }
  };
}

export class ParserCompat {
  constructor(options = {}) {
    this.options = mergeOptions(options);
  }

  parseURL(url, callback) {
    assertFeedUrl(url);
    const promise = fetchTextWithRedirects(url.trim(), this.options).then((result) => {
      if (result === null) return this.parseString('');
      return this.parseString(result.text);
    });
    return maybeCallback(promise, callback);
  }

  parseString(xml, callback) {
    const promise = Promise.resolve(parseFeedXml(xml, this.options));
    return maybeCallback(promise, callback);
  }

  parseFile(filePath, callback) {
    assertLocalFeedPath(filePath);
    const promise = readFile(filePath, 'utf8').then((xml) => this.parseString(xml));
    return maybeCallback(promise, callback);
  }

  async parseFeed(urls, config = {}) {
    const { results, feedErrors } = await runAgenticParser({
      feedUrls: normalizeFeedUrls(urls),
      dbPath: config.dbPath ?? DEFAULT_DB_PATH,
      storage: config.storage,
      fetchFullArticle: Boolean(config.fetchFullArticle),
      concurrency: config.concurrency,
      maxItems: config.maxItems,
      parserOptions: this.options,
      analyzer: config.analyzer,
      model: config.model
    });

    if (feedErrors.length > 0) {
      console.warn('[agentic-rss-parser] Feed errors:', feedErrors);
    }

    results.feedErrors = feedErrors;
    return results;
  }
}

function maybeCallback(promise, callback) {
  if (typeof callback === 'function') {
    promise.then(
      (value) => callback(null, value),
      (error) => callback(error)
    );
    return undefined;
  }
  return promise;
}

export function createParser(options = {}) {
  return new ParserCompat(options);
}

export default ParserCompat;
