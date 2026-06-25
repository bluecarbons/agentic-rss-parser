/**
 * examples/openai-agents-sdk.mjs
 *
 * Wraps agentic-rss-parser as an OpenAI Agents SDK FunctionTool.
 * Uses the @openai/agents package (released early 2025).
 *
 * Peer dependency in YOUR project:
 *   npm install @openai/agents
 *
 * Set your API key:
 *   export OPENAI_API_KEY=sk-...
 *
 * Run:
 *   node examples/openai-agents-sdk.mjs
 *   # or pass a custom feed URL:
 *   node examples/openai-agents-sdk.mjs https://techcrunch.com/feed
 *
 * Requires: Node.js >= 22.5.0
 */
import { Agent, run, tool } from '@openai/agents';
import { z } from 'zod'; // bundled with @openai/agents — no separate install needed
import { runAgenticParser, fetchFullArticle } from '../src/index.js';

// ─── Tools ───────────────────────────────────────────────────────────────────

const fetchRssFeedTool = tool({
  name: 'fetch_rss_feed',
  description:
    'Fetch and agentically analyse an RSS or Atom feed. ' +
    'Returns structured relevance decisions, confidence scores, summaries, ' +
    'action items, and tags for each feed item.',
  parameters: z.object({
    url: z.string().url().describe('The RSS or Atom feed URL to fetch.'),
    limit: z.number().int().min(1).max(100).optional().describe('Max items to return (default: 10).')
  }),
  execute: async ({ url, limit = 10 }) => {
    const { results, feedErrors } = await runAgenticParser({
      feedUrls: [url],
      dbPath: './data/rss-agent.db',
      fetchFullArticle: false,
      concurrency: 2
    });
    return JSON.stringify({ items: results.slice(0, limit), feedErrors }, null, 2);
  }
});

const fetchFullArticleTool = tool({
  name: 'fetch_full_article',
  description: 'Fetch the full plain-text content of an article URL, with HTML stripped.',
  parameters: z.object({
    url: z.string().url().describe('The article URL to fetch.')
  }),
  execute: async ({ url }) => {
    const text = await fetchFullArticle(url);
    return JSON.stringify({ url, text }, null, 2);
  }
});

// ─── Agent ───────────────────────────────────────────────────────────────────

const rssAgent = new Agent({
  name: 'RSS Feed Analyst',
  model: 'gpt-4o-mini',
  instructions:
    'You are a feed analysis assistant. ' +
    'Use the fetch_rss_feed tool whenever the user asks about news, feeds, or articles from a URL. ' +
    'Return relevant items with their summaries and tags. ' +
    'Use fetch_full_article for deeper analysis when the user asks about a specific article.',
  tools: [fetchRssFeedTool, fetchFullArticleTool]
});

// ─── Entry point ─────────────────────────────────────────────────────────────

const feedUrl = process.argv[2] ?? 'https://news.ycombinator.com/rss';
console.log(`Asking the agent to analyse: ${feedUrl}\n`);

const result = await run(
  rssAgent,
  `Fetch the RSS feed at ${feedUrl} and give me a concise summary of the 5 most relevant items.`
);

console.log('=== Agent response ===\n');
console.log(result.finalOutput ?? JSON.stringify(result, null, 2));
