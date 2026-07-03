/**
 * src/tools.js — re-exports the full public API from the canonical entry point.
 *
 * Previously this file was a partial stub exporting only analyzeFeedItem and
 * fetchFullArticle, which diverged from src/index.js and caused "not a function"
 * errors when callers imported other symbols (e.g. createStorage, createParser)
 * from this path.
 *
 * The file is kept for backward-compatibility (existing imports of
 * 'agentic-rss-parser/src/tools.js' continue to work) but now delegates
 * entirely to index.js rather than maintaining its own subset of exports.
 */
export * from './index.js';
