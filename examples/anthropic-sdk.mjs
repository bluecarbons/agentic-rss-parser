/**
 * examples/anthropic-sdk.mjs
 *
 * Shows how to wire agentic-rss-parser as a tool call in a direct
 * Anthropic Messages API conversation using the official @anthropic-ai/sdk.
 *
 * This example has ONE peer dependency in YOUR project:
 *   npm install @anthropic-ai/sdk
 *
 * Run:
 *   node examples/anthropic-sdk.mjs
 *   # or pass a custom feed URL:
 *   node examples/anthropic-sdk.mjs https://techcrunch.com/feed
 *
 * Requires: Node.js >= 22.5.0
 */
import Anthropic from '@anthropic-ai/sdk';
import { runAgenticParser, fetchFullArticle } from '../src/index.js';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY ?? 'sk-ant-...'
});

// ─── Tool definitions ────────────────────────────────────────────────────────
// These follow the Anthropic tool_use input_schema spec exactly.
// No external schema library needed — plain JSON Schema objects.

const TOOLS = [
  {
    name: 'fetch_rss_feed',
    description:
      'Fetch and agentically analyse an RSS or Atom feed. ' +
      'Returns structured relevance decisions, confidence scores, summaries, ' +
      'action items, and tags for each feed item.',
    input_schema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'The RSS or Atom feed URL to fetch.' },
        limit: {
          type: 'number',
          description: 'Maximum number of items to return (default: 10).'
        }
      },
      required: ['url']
    }
  },
  {
    name: 'fetch_full_article',
    description:
      'Fetch the full plain-text content of an article URL, with HTML stripped. ' +
      'Use when you need the full body of an article for deeper analysis.',
    input_schema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'The article URL to fetch.' }
      },
      required: ['url']
    }
  }
];

// ─── Tool executor ───────────────────────────────────────────────────────────

async function executeTool(name, input) {
  if (name === 'fetch_rss_feed') {
    const { results, feedErrors } = await runAgenticParser({
      feedUrls: [input.url],
      dbPath: './data/rss-agent.db',
      fetchFullArticle: false,
      concurrency: 2
    });
    const limit = Number.isInteger(input.limit) && input.limit > 0 ? input.limit : 10;
    return JSON.stringify({ items: results.slice(0, limit), feedErrors }, null, 2);
  }

  if (name === 'fetch_full_article') {
    const text = await fetchFullArticle(input.url);
    return JSON.stringify({ url: input.url, text }, null, 2);
  }

  throw new Error(`Unknown tool: ${name}`);
}

// ─── Agentic loop ────────────────────────────────────────────────────────────
// Standard Anthropic tool_use pattern: keep calling messages.create() until
// the model returns stop_reason === 'end_turn' with no pending tool_use blocks.

async function runAgent(userMessage) {
  const messages = [{ role: 'user', content: userMessage }];

  while (true) {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4096,
      tools: TOOLS,
      messages
    });

    // Push assistant turn into history.
    messages.push({ role: 'assistant', content: response.content });

    if (response.stop_reason === 'end_turn') {
      // Extract final text response.
      const textBlock = response.content.find((b) => b.type === 'text');
      return textBlock?.text ?? '(no text response)';
    }

    if (response.stop_reason === 'tool_use') {
      // Execute every tool_use block and collect results.
      const toolResults = [];
      for (const block of response.content) {
        if (block.type !== 'tool_use') continue;
        console.log(`[tool] calling ${block.name}(${JSON.stringify(block.input)})`);
        let result;
        try {
          result = await executeTool(block.name, block.input);
        } catch (err) {
          result = JSON.stringify({ error: err.message });
        }
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: result
        });
      }
      messages.push({ role: 'user', content: toolResults });
      continue;
    }

    // Unexpected stop_reason — break to avoid an infinite loop.
    break;
  }

  return '(agent loop ended without a final response)';
}

// ─── Entry point ─────────────────────────────────────────────────────────────

const feedUrl = process.argv[2] ?? 'https://news.ycombinator.com/rss';
const answer = await runAgent(
  `Fetch the RSS feed at ${feedUrl} and give me a concise summary of the 5 most relevant items.`
);
console.log('\n=== Claude\'s response ===\n');
console.log(answer);
