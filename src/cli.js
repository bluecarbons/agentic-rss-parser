#!/usr/bin/env node
import { resolve } from 'node:path';
import { runAgenticParser } from './parser.js';
import { DEFAULT_DB_PATH } from './core/db-path.js';

const ALLOWED_PROVIDERS = new Set(['heuristic', 'openai', 'anthropic', 'local']);

function parseArgs(argv) {
  const args = {
    feeds: [],
    db: DEFAULT_DB_PATH,
    fetchFullArticle: false,
    provider: undefined,
    apiKey: undefined,
    model: undefined,
    baseURL: undefined
  };
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
    } else if (current === '--provider') {
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        console.error('Error: --provider requires a value');
        process.exit(1);
      }
      if (!ALLOWED_PROVIDERS.has(next)) {
        console.error(`Error: --provider must be one of: ${[...ALLOWED_PROVIDERS].join(', ')}`);
        process.exit(1);
      }
      args.provider = next;
      i += 1;
    } else if (current === '--api-key') {
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        console.error('Error: --api-key requires a value');
        process.exit(1);
      }
      args.apiKey = next;
      i += 1;
    } else if (current === '--model') {
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        console.error('Error: --model requires a value');
        process.exit(1);
      }
      args.model = next;
      i += 1;
    } else if (current === '--base-url') {
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        console.error('Error: --base-url requires a value');
        process.exit(1);
      }
      args.baseURL = next;
      i += 1;
    }
  }
  return args;
}

const args = parseArgs(process.argv);

if (!args.feeds.length) {
  console.error(
    'Usage: agentic-rss --feed <url> [--feed <url>] [--db <path>] [--fetch-full-article]\n' +
    '                    [--provider heuristic|openai|anthropic|local] [--api-key <key>]\n' +
    '                    [--model <id>] [--base-url <url>]'
  );
  process.exit(1);
}

const dbPath = resolve(args.db);

// BUGFIX: previously the CLI had no way to select a provider at all, so the
// README's "LLM analysis" feature was unreachable from this entry point —
// only the plain heuristic analyzer (the default when `model` is omitted)
// ever ran. --provider/--api-key/--model/--base-url now flow through to
// runAgenticParser -> createAnalyzer. apiKey falls back to the provider's
// conventional environment variable when the flag isn't passed.
const envKey =
  args.provider === 'openai'
    ? process.env.OPENAI_API_KEY
    : args.provider === 'anthropic'
      ? process.env.ANTHROPIC_API_KEY
      : undefined;

const { results, feedErrors } = await runAgenticParser({
  feedUrls: args.feeds,
  dbPath,
  fetchFullArticle: args.fetchFullArticle,
  model: args.provider
    ? { provider: args.provider, apiKey: args.apiKey || envKey, model: args.model, baseURL: args.baseURL }
    : undefined
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
