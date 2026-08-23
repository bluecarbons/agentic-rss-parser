#!/usr/bin/env node
import readline from 'node:readline';
import { runAgenticParser } from '../parser.js';
import { createAnalyzer } from '../adapters/provider.js';
import { fetchFullArticle } from '../fetch-article.js';
import { assertHttpUrl } from '../core/http.js';
import { DEFAULT_DB_PATH } from '../core/db-path.js';
import pkg from '../../package.json' with { type: 'json' };

const { version: PKG_VERSION } = pkg;

const ALLOWED_PROVIDERS = new Set(['heuristic', 'openai', 'anthropic', 'local']);
const MAX_CONCURRENT_TOOL_CALLS = normalizeMaxConcurrent(process.env.AGENTIC_RSS_MAX_CONCURRENCY);
let activeToolCalls = 0;
const toolCallQueue = [];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

import { createStorage } from '../storage.js';

const resources = [
  {
    uri: 'rss://analyses/latest',
    name: 'Latest RSS Feed Analyses',
    description: 'Recent relevant article analyses stored in the SQLite database.',
    mimeType: 'application/json'
  }
];

const tools = [
  {
    name: 'fetch_rss_feed',
    description:
      'Fetch and agentically analyse an RSS, Atom, or JSON feed. Returns structured relevance decisions, confidence scores, summaries, action items, and tags for each feed item.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'The RSS, Atom, or JSON feed URL to fetch.' },
        limit: {
          type: 'number',
          description: 'Maximum number of items to return (default: 10).',
          default: 10
        },
        provider: {
          type: 'string',
          enum: ['heuristic', 'openai', 'anthropic', 'local'],
          default: 'heuristic',
          description: 'Analysis provider to use. Defaults to heuristic (no API key required).'
        },
        apiKey: {
          type: 'string',
          description:
            'API key for the "openai" or "anthropic" provider. Falls back to the ' +
            'OPENAI_API_KEY / ANTHROPIC_API_KEY environment variable when omitted and using standard endpoints. ' +
            'Not required for "heuristic" or "local".'
        },
        model: {
          type: 'string',
          description: 'Override the default model id for the selected provider.'
        },
        baseURL: {
          type: 'string',
          description: 'Override the default API base URL (e.g. a self-hosted OpenAI-compatible endpoint).'
        }
      },
      required: ['url']
    }
  },
  {
    name: 'fetch_full_article',
    description:
      'Fetch the full plain-text content of an article URL, with HTML stripped. Useful for passing article body as context to a subsequent LLM analysis call.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'The article URL to fetch and strip to plain text.' }
      },
      required: ['url']
    }
  },
  {
    name: 'search_feed_history',
    description: 'Search previously analyzed articles and intelligence in the persistent database.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Keyword query to search across titles, summaries, impact, and tags.' },
        limit: { type: 'number', description: 'Maximum number of results to return (default: 20).', default: 20 }
      },
      required: ['query']
    }
  },
  {
    name: 'get_feed_statistics',
    description: 'Retrieve statistical metrics about processed feeds, total analyses, and relevance ratios.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'prune_database',
    description: 'Prune cached feed items and analyses older than a specified number of days.',
    inputSchema: {
      type: 'object',
      properties: {
        ttlDays: { type: 'number', description: 'Number of days of data to retain (must be > 0).', default: 30 }
      },
      required: ['ttlDays']
    }
  }
];

rl.on('line', async (line) => {
  let requestId;
  try {
    const request = JSON.parse(line);
    requestId = request.id;

    if (request.jsonrpc !== '2.0') {
      return;
    }

    if (request.method === 'initialize') {
      sendResponse(requestId, {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {}, resources: {} },
        serverInfo: { name: 'agentic-rss-parser', version: PKG_VERSION }
      });
      return;
    }

    if (request.method === 'notifications/initialized') {
      return;
    }

    if (request.method === 'tools/list') {
      sendResponse(requestId, { tools });
      return;
    }

    if (request.method === 'resources/list') {
      sendResponse(requestId, { resources });
      return;
    }

    if (request.method === 'resources/read') {
      const uri = request.params?.uri;
      if (uri === 'rss://analyses/latest') {
        const storage = createStorage(DEFAULT_DB_PATH);
        try {
          const analyses = storage.getAnalyses({ limit: 25, decision: 'relevant' });
          sendResponse(requestId, {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(analyses, null, 2)
              }
            ]
          });
        } finally {
          storage.close();
        }
        return;
      }
      sendError(requestId, -32602, `Unknown resource URI: ${uri}`);
      return;
    }

    if (request.method === 'tools/call') {
      const { name, arguments: args } = request.params || {};

      if (!name || typeof name !== 'string') {
        sendError(requestId, -32602, 'Invalid params: missing tool name');
        return;
      }
      if (args === null || args === undefined || typeof args !== 'object' || Array.isArray(args)) {
        sendError(requestId, -32602, 'Invalid params: arguments must be a JSON object');
        return;
      }

      try {
        const result = await enqueueToolCall(() => handleToolCall(name, args));
        sendResponse(requestId, result);
      } catch (err) {
        const code = err.code === -32602 ? -32602 : -32603;
        sendError(requestId, code, err.message);
      }
      return;
    }

    if (requestId !== undefined) {
      sendError(requestId, -32601, 'Method not found');
    }
  } catch {
    sendError(null, -32700, 'Parse error');
  }
});

function sendResponse(id, result) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n');
}

function sendError(id, code, message) {
  process.stdout.write(
    JSON.stringify({ jsonrpc: '2.0', id: id ?? null, error: { code, message } }) + '\n'
  );
}

function normalizeMaxConcurrent(raw) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 1) return 3;
  return Math.min(16, Math.trunc(parsed));
}

async function enqueueToolCall(fn) {
  if (activeToolCalls >= MAX_CONCURRENT_TOOL_CALLS) {
    await new Promise((resolve) => toolCallQueue.push(resolve));
  }
  activeToolCalls += 1;
  try {
    return await fn();
  } finally {
    activeToolCalls -= 1;
    const next = toolCallQueue.shift();
    if (next) next();
  }
}

async function handleToolCall(name, args) {
  if (name === 'fetch_rss_feed') {
    if (typeof args.url !== 'string' || !args.url.trim()) {
      throw Object.assign(
        new Error('Invalid params: url is required and must be a non-empty string'),
        { code: -32602 }
      );
    }

    const rawProvider = args.provider;
    if (rawProvider !== undefined && !ALLOWED_PROVIDERS.has(rawProvider)) {
      throw Object.assign(
        new Error(
          `Invalid params: provider must be one of: ${[...ALLOWED_PROVIDERS].join(', ')}`
        ),
        { code: -32602 }
      );
    }
    if (args.apiKey !== undefined && typeof args.apiKey !== 'string') {
      throw Object.assign(new Error('Invalid params: apiKey must be a string'), { code: -32602 });
    }
    if (args.model !== undefined && typeof args.model !== 'string') {
      throw Object.assign(new Error('Invalid params: model must be a string'), { code: -32602 });
    }
    if (args.baseURL !== undefined && typeof args.baseURL !== 'string') {
      throw Object.assign(new Error('Invalid params: baseURL must be a string'), { code: -32602 });
    }

    const url = args.url.trim();
    const limit =
      Number.isInteger(args.limit) && args.limit > 0 && args.limit <= 1000 ? args.limit : 10;
    const provider = rawProvider || 'heuristic';

    // SECURITY: Only fall back to process.env keys if baseURL is undefined or
    // points to the official standard provider API domain. If a custom / untrusted
    // baseURL is specified, the caller must explicitly pass args.apiKey to prevent
    // credential exfiltration to unauthorized endpoints.
    const isStandardOpenAi = !args.baseURL || /^https:\/\/(?:api\.)?openai\.com(?:\/|$)/i.test(args.baseURL);
    const isStandardAnthropic = !args.baseURL || /^https:\/\/(?:api\.)?anthropic\.com(?:\/|$)/i.test(args.baseURL);

    const envKey =
      provider === 'openai' && isStandardOpenAi
        ? process.env.OPENAI_API_KEY
        : provider === 'anthropic' && isStandardAnthropic
          ? process.env.ANTHROPIC_API_KEY
          : undefined;

    if (args.baseURL) {
      try {
        assertHttpUrl(args.baseURL);
      } catch (err) {
        throw Object.assign(new Error(`Invalid baseURL: ${err.message}`), { code: -32602 });
      }
    }

    const modelConfig = {
      provider,
      apiKey: args.apiKey || envKey,
      model: args.model,
      baseURL: args.baseURL
    };

    const analyzer = await createAnalyzer(modelConfig);
    const { results, feedErrors } = await runAgenticParser({
      feedUrls: [url],
      dbPath: DEFAULT_DB_PATH,
      analyzer,
      model: modelConfig,
      maxItems: limit
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ results, feedErrors }, null, 2)
        }
      ]
    };
  }

  if (name === 'fetch_full_article') {
    if (typeof args.url !== 'string' || !args.url.trim()) {
      throw Object.assign(
        new Error('Invalid params: url is required and must be a non-empty string'),
        { code: -32602 }
      );
    }
    const url = args.url.trim();

    try {
      assertHttpUrl(url);
    } catch (err) {
      throw Object.assign(new Error(`Invalid params: ${err.message}`), { code: -32602 });
    }

    const text = await fetchFullArticle(url);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ url, text }, null, 2)
        }
      ]
    };
  }

  if (name === 'search_feed_history') {
    if (typeof args.query !== 'string' || !args.query.trim()) {
      throw Object.assign(
        new Error('Invalid params: query is required and must be a non-empty string'),
        { code: -32602 }
      );
    }
    const storage = createStorage(DEFAULT_DB_PATH);
    try {
      const results = storage.searchAnalyses(args.query, { limit: args.limit });
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ query: args.query, results }, null, 2)
          }
        ]
      };
    } finally {
      storage.close();
    }
  }

  if (name === 'get_feed_statistics') {
    const storage = createStorage(DEFAULT_DB_PATH);
    try {
      const stats = storage.getStatistics();
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(stats, null, 2)
          }
        ]
      };
    } finally {
      storage.close();
    }
  }

  if (name === 'prune_database') {
    const ttlDays = typeof args.ttlDays === 'number' && args.ttlDays > 0 ? args.ttlDays : 30;
    const storage = createStorage(DEFAULT_DB_PATH);
    try {
      const result = storage.pruneOlderThan(ttlDays);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ ttlDays, ...result }, null, 2)
          }
        ]
      };
    } finally {
      storage.close();
    }
  }

  throw new Error(`Tool not found: ${name}`);
}
