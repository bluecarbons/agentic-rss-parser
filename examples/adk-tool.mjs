import { z } from 'zod';
import { runAgenticParser } from '../src/index.js';

export const fetchRssFeedTool = {
  name: 'fetch_rss_feed',
  description:
    'Fetches and normalizes an RSS or Atom feed, with optional agentic analysis and deduplication.',
  schema: z.object({
    url: z.string().url().describe('The RSS or Atom feed URL.'),
    fetchFullArticle: z.boolean().default(false).describe('Whether to fetch full article text.'),
  }),
  execute: async ({ url, fetchFullArticle }) => {
    const results = await runAgenticParser({
      feedUrls: [url],
      dbPath: './data/rss-agent.db',
      fetchFullArticle
    });

    return {
      items: results.map((entry) => entry.item),
      analyses: results.map((entry) => entry.analysis)
    };
  }
};
