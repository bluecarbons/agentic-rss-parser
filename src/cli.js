#!/usr/bin/env node
import { resolve } from 'node:path';
import { runAgenticParser } from './parser.js';
import { DEFAULT_DB_PATH } from './core/db-path.js';

function parseArgs(argv) {
  const args = { feeds: [], db: DEFAULT_DB_PATH, fetchFullArticle: false };
  for (let i = 2; i < argv.length; i += 1) {
    const current = argv[i];
    if (current === '--feed') {
      // CORRECTNESS: guard against a missing value (next token is another flag
      // or end-of-args). Previously argv[++i] could silently capture a flag
      // name as the feed URL, or resolve(undefined) as the db path.
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        console.error('Error: --feed requires a URL argument');
        process.exit(1);
      }
      args.feeds.push(next);
      i += 1;
    } else if (current === '--db') {
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        console.error('Error: --db requires a path argument');
        process.exit(1);
      }
      args.db = next;
      i += 1;
    } else if (current === '--fetch-full-article') {
      args.fetchFullArticle = true;
    }
  }
  return args;
}

const args = parseArgs(process.argv);

if (!args.feeds.length) {
  console.error(
    'Usage: agentic-rss --feed <url> [--feed <url>] [--db <path>] [--fetch-full-article]'
  );
  process.exit(1);
}

const dbPath = resolve(args.db);

const { results, feedErrors } = await runAgenticParser({
  feedUrls: args.feeds,
  dbPath,
  fetchFullArticle: args.fetchFullArticle
});

// Surface per-feed errors to stderr so CI/scripts can detect partial failures.
if (feedErrors.length) {
  for (const { feedUrl, error } of feedErrors) {
    console.error(`[error] ${feedUrl}: ${error}`);
  }
  // Non-zero exit when every feed failed; partial success still exits 0.
  if (!results.length) {
    process.exitCode = 1;
  }
}

for (const { item, analysis } of results) {
  if (analysis.decision === 'relevant') {
    console.log(JSON.stringify({ title: item.title, link: item.link, ...analysis }, null, 2));
  }
}
