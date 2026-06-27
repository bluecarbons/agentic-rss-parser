/**
 * examples/vercel-ai-sdk.mjs
 *
 * Uses the Vercel AI SDK (npm: ai) to expose agentic-rss-parser
 * as a tool inside a generateText() call. Works with any ai-sdk
 * provider: Anthropic, OpenAI, Google, Mistral, etc.
 *
 * Peer dependencies in YOUR project:
 *   npm install ai @ai-sdk/anthropic
 *   # or swap for @ai-sdk/openai, @ai-sdk/google, etc.
 *
 * Set your key:
 *   export ANTHROPIC_API_KEY=sk-ant-...
 *
 * Run:
 *   node examples/vercel-ai-sdk.mjs
 *   node examples/vercel-ai-sdk.mjs https://techcrunch.com/feed
 *
 * Requires: Node.js >= 22.5.0
 */
import { generateText, tool } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { z } from 'zod'; // bundled with ai — no separate install needed
import { runAgenticParser, fetchFullArticle } from '../src/index.js';

const anthropic = createAnthropic();

// ─── Tools ───────────────────────────────────────────────────────────────────

const tools = {
  fetch_rss_feed: tool({
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
      return { items: results.slice(0, limit), feedErrors };
    }
  }),

  fetch_full_article: tool({
    description: 'Fetch the full plain-text content of an article URL, with HTML stripped.',
    parameters: z.object({
      url: z.string().url().describe('The article URL to fetch.')
    }),
    execute: async ({ url }) => {
      const text = await fetchFullArticle(url);
      return { url, text };
    }
  })
};

// ─── Entry point ─────────────────────────────────────────────────────────────

const feedUrl = process.argv[2] ?? 'https://news.ycombinator.com/rss';
console.log(`Asking the model to analyse: ${feedUrl}\n`);

const { text, toolCalls, toolResults } = await generateText({
  model: anthropic('claude-sonnet-4-6'),
  tools,
  maxSteps: 5, // allow multi-step tool use
  prompt: `Fetch the RSS feed at ${feedUrl} and give me a concise summary of the 5 most relevant items.`
});

console.log('=== Model response ===\n');
console.log(text);

if (toolCalls?.length) {
  console.log(`\n[debug] Tool calls made: ${toolCalls.map((c) => c.toolName).join(', ')}`);
}
