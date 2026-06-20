import { readFile } from 'node:fs/promises';
import { runAgenticParser } from './parser.js';
import { parseFeedXml } from './core/parser.js';
import { fetchTextWithRedirects } from './core/http.js';

const DEFAULT_OPTIONS = {
  normalize: true,
  customFields: { feed: [], item: [] },
  headers: undefined,
  timeout: 10000,
  maxRedirects: 5,
  requestOptions: {},
  defaultRSS: 2.0,
  xml2js: {}
};

function mergeOptions(options = {}) {
  return {
    ...DEFAULT_OPTIONS,
    ...options,
    customFields: {
      feed: [...(DEFAULT_OPTIONS.customFields.feed || []), ...(options.customFields?.feed || [])],
      item: [...(DEFAULT_OPTIONS.customFields.item || []), ...(options.customFields?.item || [])]
    },
    requestOptions: {
      ...DEFAULT_OPTIONS.requestOptions,
      ...(options.requestOptions || {})
    },
    xml2js: {
      ...DEFAULT_OPTIONS.xml2js,
      ...(options.xml2js || {})
    }
  };
}

export class ParserCompat {
  constructor(options = {}) {
    this.options = mergeOptions(options);
  }

  parseURL(url, callback) {
    const promise = fetchTextWithRedirects(url, this.options).then((xml) => this.parseString(xml));

    return maybeCallback(promise, callback);
  }

  parseString(xml, callback) {
    const promise = parseFeedXml(xml, this.options);
    return maybeCallback(promise, callback);
  }

  parseFile(filePath, callback) {
    const promise = readFile(filePath, 'utf8').then((xml) => this.parseString(xml));
    return maybeCallback(promise, callback);
  }

  async parseFeed(urls, config = {}) {
    return runAgenticParser({
      feedUrls: Array.isArray(urls) ? urls : [urls],
      dbPath: config.dbPath ?? './data/rss-agent.db',
      fetchFullArticle: Boolean(config.fetchFullArticle),
      parserOptions: this.options,
      analyzer: config.analyzer,
      model: config.model
    });
  }
}

function maybeCallback(promise, callback) {
  if (typeof callback === 'function') {
    promise.then((value) => callback(null, value), (error) => callback(error));
    return undefined;
  }
  return promise;
}

export function createParser(options = {}) {
  return new ParserCompat(options);
}

export default ParserCompat;
