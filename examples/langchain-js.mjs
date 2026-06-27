/**
 * examples/langchain-js.mjs
 *
 * Wraps agentic-rss-parser as a LangChain.js DynamicStructuredTool so any
 * LangChain agent (ReAct, OpenAI Functions, Anthropic tool_use, etc.) can
 * call it to fetch and analyse RSS / Atom feeds.
 *
 * Peer dependencies in YOUR project:
 *   npm install langchain @langchain/anthropic zod
 *   # or swap @langchain/anthropic for @langchain/openai, @langchain/google-genai, etc.
 *
 * Set your key:
 *   export ANTHROPIC_API_KEY=sk-ant-...
 *
 * Run:
 *   node examples/langchain-js.mjs
 *   node examples/langchain-js.mjs https://techcrunch.com/feed
 *
 * Requires: Node.js >= 22.5.0
 */
import { DynamicStructuredTool } from 'langchain/tools';
import { ChatAnthropic } from '@langchain/anthropic';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { z } from 'zod';
import { runAgenticParser, fetchFullArticle } from '../src/index.js';

// ─── Tools ───────────────────────────────────────────────────────────────────

const fetchRssFeedTool = new DynamicStructuredTool({
  name: 'fetch_rss_feed',
  description:
    'Fetch and agentically analyse an RSS or Atom feed. ' +
    'Returns structured relevance decisions, confidence scores, summaries, ' +
    'action items, and tags for each feed item.',
  schema: z.object({
    url: z.string().url().describe('The RSS or Atom feed URL to fetch.'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe('Maximum number of items to return (default: 10).')
  }),
  func: async ({ url, limit = 10 }) => {
    const { results, feedErrors } = await runAgenticParser({
      feedUrls: [url],
      dbPath: './data/rss-agent.db',
      fetchFullArticle: false,
      concurrency: 2
    });
    return JSON.stringify({ items: results.slice(0, limit), feedErrors }, null, 2);
  }
});

const fetchFullArticleTool = new DynamicStructuredTool({
  name: 'fetch_full_article',
  description:
    'Fetch the full plain-text content of an article URL, with HTML stripped. ' +
    'Use when you need the full body of an article for deeper analysis.',
  schema: z.object({
    url: z.string().url().describe('The article URL to fetch.')
  }),
  func: async ({ url }) => {
    const text = await fetchFullArticle(url);
    return JSON.stringify({ url, text }, null, 2);
  }
});

const tools = [fetchRssFeedTool, fetchFullArticleTool];

// ─── Agent ───────────────────────────────────────────────────────────────────

const llm = new ChatAnthropic({
  model: 'claude-sonnet-4-6',
  temperature: 0
});

const prompt = ChatPromptTemplate.fromMessages([
  [
    'system',
    'You are a feed analysis assistant. ' +
      'Use the fetch_rss_feed tool whenever the user asks about news, feeds, or articles from a URL. ' +
      'Return relevant items with their summaries and tags. ' +
      'Use fetch_full_article for deeper analysis when asked about a specific article.'
  ],
  ['human', '{input}'],
  ['placeholder', '{agent_scratchpad}']
]);

const agent = createToolCallingAgent({ llm, tools, prompt });
const executor = new AgentExecutor({ agent, tools });

// ─── Entry point ─────────────────────────────────────────────────────────────

const feedUrl = process.argv[2] ?? 'https://news.ycombinator.com/rss';
console.log(`Asking the agent to analyse: ${feedUrl}\n`);

const result = await executor.invoke({
  input: `Fetch the RSS feed at ${feedUrl} and give me a concise summary of the 5 most relevant items.`
});

console.log('=== Agent response ===\n');
console.log(result.output);
