/**
 * examples/adk-real.mjs
 *
 * Wraps agentic-rss-parser as a Google ADK FunctionTool so an LlmAgent
 * can call it to ingest, deduplicate, and enrich RSS/Atom feeds.
 *
 * Prerequisites (install in your project — NOT part of agentic-rss-parser):
 *   npm install @google/adk
 *   # or
 *   pnpm add @google/adk
 *
 * Run: node examples/adk-real.mjs
 * Requires: Node.js >= 22.5.0, GOOGLE_API_KEY env var set.
 */
import { FunctionTool, LlmAgent, InMemoryRunner } from '@google/adk';
import { runAgenticParser } from '../src/index.js';

/**
 * fetchRssFeed — ADK FunctionTool
 *
 * Parameters are declared as a plain JSON Schema object so this example
 * has zero additional dependencies (no zod required).
 */
const fetchRssFeed = new FunctionTool({
  name: 'fetch_rss_feed',
  description:
    'Fetches, normalizes, deduplicates, and optionally enriches RSS or Atom feeds. ' +
    'Returns structured feed items and heuristic analysis for each entry.',
  parameters: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'The RSS or Atom feed URL to fetch.'
      },
      fetchFullArticle: {
        type: 'boolean',
        description: 'Whether to fetch the full article body for each item. Defaults to false.',
        default: false
      }
    },
    required: ['url']
  },
  execute: async ({ url, fetchFullArticle = false }) => {
    // runAgenticParser returns { results, feedErrors } — always destructure.
    const { results, feedErrors } = await runAgenticParser({
      feedUrls: [url],
      dbPath: './data/rss-agent.db',
      fetchFullArticle,
      concurrency: 2
    });

    return {
      status: 'success',
      feedCount: results.length,
      feedErrors,
      items: results.map((entry) => entry.item),
      analyses: results.map((entry) => entry.analysis)
    };
  }
});

/**
 * rssAgent — LlmAgent backed by Gemini.
 *
 * Swap `model` for any ADK-supported model string.
 * The agent uses fetch_rss_feed whenever it needs live feed data.
 */
export const rssAgent = new LlmAgent({
  name: 'rss_ingest_agent',
  model: 'gemini-2.0-flash',
  description: 'Ingests and summarizes RSS/Atom feeds using Agentic RSS Parser.',
  instruction:
    'You are a feed analysis assistant. ' +
    'Use the fetch_rss_feed tool whenever the user asks about news, feeds, or articles from a URL. ' +
    'Return relevant items with their summaries.',
  tools: [fetchRssFeed]
});

// --- Minimal runner example (prints relevant items to stdout) ---
if (process.argv[1].endsWith('adk-real.mjs')) {
  const feedUrl = process.argv[2] ?? 'https://news.ycombinator.com/rss';
  const runner = new InMemoryRunner({ agent: rssAgent });
  const response = await runner.run(`Fetch and summarize the feed at ${feedUrl}`);
  console.log(response.text ?? JSON.stringify(response, null, 2));
}
