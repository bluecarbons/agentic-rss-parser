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

const tools = [
  {
    name: 'fetch_rss_feed',
    description:
      'Fetch and agentically analyse an RSS or Atom feed. Returns structured relevance decisions, confidence scores, summaries, action items, and tags for each feed item.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'The RSS or Atom feed URL to fetch.' },
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
        capabilities: { tools: {} },
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

    const url = args.url.trim();
    const limit =
      Number.isInteger(args.limit) && args.limit > 0 && args.limit <= 1000 ? args.limit : 10;
    const provider = rawProvider || 'heuristic';

    const analyzer = await createAnalyzer({ provider });
    const { results, feedErrors } = await runAgenticParser({
      feedUrls: [url],
      dbPath: DEFAULT_DB_PATH,
      analyzer,
      model: { provider },
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

  throw new Error(`Tool not found: ${name}`);
}
