import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { readFile } from 'node:fs/promises';
import { runAgenticParser } from './parser.js';
import { parseFeedXml } from './core/parser.js';
import { fetchTextWithRedirects } from './core/http.js';

/**
 * Default DB path strategy (two-tier):
 *
 *   1. process.cwd()/data/rss-agent.db  — when installed as a package
 *      (node_modules/agentic-rss-parser/...), the CWD is the consumer's
 *      project root, so the DB lands next to their own source files.
 *
 *   2. <package-root>/data/rss-agent.db  — fallback when running directly
 *      from a clone of this repo (CWD === package root).
 *
 * In both cases this beats the old module-relative path which could land
 * inside node_modules when the package is installed.
 *
 * Users can always override via config.dbPath in parseFeed() or by passing
 * dbPath directly to runAgenticParser().
 */
const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(__dirname, '..');
const CWD = process.cwd();
// Use CWD-relative path unless we are already inside the package root
// (i.e. running directly from a repo clone). Detect via simple prefix check.
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
      // fetchTextWithRedirects returns null on 304 Not Modified.
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

  /**
   * Run the full agentic pipeline over one or more feed URLs.
   *
   * COHERENCE FIX: runAgenticParser now returns { results, feedErrors }.
   * This method destructures and returns only `results` so callers of the
   * compat API get the flat items array they expect — consistent with the
   * rss-parser migration contract and the TypeScript declaration.
   *
   * @param {string|string[]} urls
   * @param {object} [config]
   * @returns {Promise<Array<{item, analysis}>>}
   */
  async parseFeed(urls, config = {}) {
    const { results } = await runAgenticParser({
      feedUrls: normalizeFeedUrls(urls),
      dbPath: config.dbPath ?? DEFAULT_DB_PATH,
      fetchFullArticle: Boolean(config.fetchFullArticle),
      concurrency: config.concurrency,
      parserOptions: this.options,
      analyzer: config.analyzer,
      model: config.model
    });
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
