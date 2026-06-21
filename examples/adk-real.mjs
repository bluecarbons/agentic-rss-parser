import { FunctionTool, LlmAgent } from '@google/adk';
import { z } from 'zod';
import { runAgenticParser } from '../src/index.js';

const fetchRssFeed = new FunctionTool({
  name: 'fetch_rss_feed',
  description: 'Fetches, normalizes, deduplicates, and optionally enriches RSS or Atom feeds.',
  parameters: z.object({
    url: z.string().url().describe('The RSS or Atom feed URL to fetch.'),
    fetchFullArticle: z.boolean().default(false).describe('Whether to fetch the full article body.'),
  }),
  execute: async ({ url, fetchFullArticle }) => {
    const results = await runAgenticParser({
      feedUrls: [url],
      dbPath: './data/rss-agent.db',
      fetchFullArticle,
      concurrency: 2
    });

    return {
      status: 'success',
      feedCount: results.length,
      items: results.map((entry) => entry.item),
      analyses: results.map((entry) => entry.analysis)
    };
  }
});

export const rssAgent = new LlmAgent({
  name: 'rss_ingest_agent',
  model: 'gemini-flash-latest',
  description: 'Ingests and summarizes RSS feeds using Agentic RSS Parser.',
  instruction:
    'Use fetch_rss_feed when you need normalized feed items, deduplication, or article enrichment.',
  tools: [fetchRssFeed]
});
