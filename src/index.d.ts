// ─── Shared building blocks ──────────────────────────────────────────────────

export interface CustomFieldTuple {
  0: string;
  1: string;
  2?: {
    keepArray?: boolean;
    includeSnippet?: boolean;
  };
}

export interface CustomFieldConfig {
  feed?: Array<string | [string, string] | CustomFieldTuple>;
  item?: Array<string | [string, string] | CustomFieldTuple>;
}

/** Options accepted by the parser layer (parseURL / parseString / parseFile). */
export interface ParserOptions {
  customFields?: CustomFieldConfig;
  /** Fallback RSS version used when the feed does not declare one. */
  defaultRSS?: number | string;
  headers?: Record<string, string>;
  /**
   * Override the User-Agent header sent with every feed request.
   * Useful when a feed returns 403 to the default `agentic-rss-parser/<version>` UA.
   * Equivalent to passing `headers: { 'user-agent': '...' }`; if both are set,
   * `headers['user-agent']` takes precedence.
   *
   * @example
   * const parser = new Parser({
   *   userAgent: 'Mozilla/5.0 (compatible; MyApp/1.0)'
   * });
   */
  userAgent?: string;
  /** Request timeout in milliseconds (default: 10 000). */
  timeout?: number;
  /** Maximum number of HTTP redirects to follow (default: 5). */
  maxRedirects?: number;
  requestOptions?: Record<string, unknown>;
  normalize?: boolean;
}

// ─── Feed / item shapes ──────────────────────────────────────────────────────

export interface ParserFeedItem {
  title?: string;
  link?: string;
  pubDate?: string;
  isoDate?: string;
  content?: string;
  contentSnippet?: string;
  guid?: string;
  categories?: string[];
  creator?: string;
  [key: string]: unknown;
}

export interface ParserFeed<Feed = unknown, Item = ParserFeedItem> {
  feedUrl?: string;
  title?: string;
  description?: string;
  link?: string;
  items: Item[];
  [key: string]: unknown;
}

export type ParserCallback<T> = (err: Error | null, result?: T) => void;

// ─── Analysis shapes ─────────────────────────────────────────────────────────

/** The normalised result returned by every analysis provider. */
export interface AnalysisResult {
  decision: 'relevant' | 'ignore';
  /** Integer 0–100. */
  confidence: number;
  summary: string;
  impact: string;
  actionItems: string[];
  tags: string[];
}

/** A feed-level error recorded when one URL in a batch fails. */
export interface FeedError {
  feedUrl: string;
  error: string;
}

/** Return shape of runAgenticParser. */
export interface AgenticParserResult {
  results: Array<{ item: ParserFeedItem; analysis: AnalysisResult }>;
  feedErrors: FeedError[];
}

// ─── Config shapes ───────────────────────────────────────────────────────────

export interface AnalyzerConfig {
  provider?: 'heuristic' | 'openai' | 'anthropic' | 'local';
  model?: string;
  apiKey?: string;
  baseURL?: string;
  /**
   * Full replacement signal list for the heuristic provider.
   * When set, DEFAULT_HEURISTIC_SIGNALS are ignored entirely.
   *
   * @example
   * // Startup-focused signals — completely replaces the dev-tool defaults
   * signals: ['funding', 'series', 'yc', 'ipo', 'acquisition', 'launch', 'ai', 'b2b']
   */
  signals?: string[];
  /**
   * Extra signals appended to DEFAULT_HEURISTIC_SIGNALS.
   * Use instead of `signals` when you want to extend the defaults, not replace them.
   *
   * @example
   * extraSignals: ['funding', 'acquisition', 'launch']
   */
  extraSignals?: string[];
  /**
   * Minimum number of matched signals required to mark an item 'relevant'.
   * Defaults to 3. Reduce to 1-2 for broader recall; increase to 4-5 for precision.
   */
  threshold?: number;
}

export interface AgenticParserConfig {
  feedUrls: string[];
  /** Absolute path to the SQLite database file. */
  dbPath: string;
  fetchFullArticle?: boolean;
  concurrency?: number;
  parserOptions?: ParserOptions;
  analyzer?: (input: { item: ParserFeedItem; context: string }) => unknown;
  model?: AnalyzerConfig;
}

export interface ParseFeedConfig {
  /** Override the default DB path (resolved to CWD/data/rss-agent.db when installed as a package). */
  dbPath?: string;
  fetchFullArticle?: boolean;
  concurrency?: number;
  analyzer?: (input: { item: ParserFeedItem; context: string }) => unknown;
  model?: AnalyzerConfig;
}

// ─── Parser class ────────────────────────────────────────────────────────────

export class Parser<Feed = unknown, Item = ParserFeedItem> {
  constructor(options?: ParserOptions);

  parseURL(url: string): Promise<ParserFeed<Feed, Item>>;
  parseURL(url: string, callback: ParserCallback<ParserFeed<Feed, Item>>): void;

  parseString(xml: string): Promise<ParserFeed<Feed, Item>>;
  parseString(xml: string, callback: ParserCallback<ParserFeed<Feed, Item>>): void;

  parseFile(path: string): Promise<ParserFeed<Feed, Item>>;
  parseFile(path: string, callback: ParserCallback<ParserFeed<Feed, Item>>): void;

  /**
   * Run the full agentic pipeline over one or more feed URLs.
   * Returns the items array directly (feedErrors are surfaced via feedErrors property).
   */
  parseFeed(
    urls: string | string[],
    config?: ParseFeedConfig
  ): Promise<Array<{ item: Item; analysis: AnalysisResult }>>;
}

export function createParser<Feed = unknown, Item = ParserFeedItem>(
  options?: ParserOptions
): Parser<Feed, Item>;

// ─── Core functions ──────────────────────────────────────────────────────────

/**
 * Run the agentic parser pipeline.
 * Returns both successful results and per-feed errors.
 */
export function runAgenticParser(
  config: AgenticParserConfig
): Promise<AgenticParserResult>;

export function analyzeFeedItem(
  item: ParserFeedItem,
  options?: {
    fetchFullArticle?: boolean;
    analyzer?: (input: { item: ParserFeedItem; context: string }) => unknown;
    signals?: string[];
    extraSignals?: string[];
    threshold?: number;
  }
): Promise<AnalysisResult>;

/**
 * Heuristic signal-based analyser — no LLM or API key required.
 * Single source of truth; also used internally by the heuristic provider.
 *
 * @param item    - Feed item to analyse.
 * @param context - Optional expanded article text.
 * @param options - Signal customization: `signals` (replace), `extraSignals` (append), `threshold`.
 */
export function heuristicAnalyze(
  item: ParserFeedItem,
  context?: string,
  options?: {
    signals?: string[];
    extraSignals?: string[];
    threshold?: number;
  }
): AnalysisResult;

/**
 * The default heuristic signal list (dev/tech-tool focused).
 * Export so callers can inspect it before deciding to extend or replace it.
 */
export const DEFAULT_HEURISTIC_SIGNALS: string[];

/**
 * Resolve the effective signal list from user-supplied options.
 * Priority: options.signals > DEFAULT + options.extraSignals > DEFAULT.
 */
export function resolveSignals(
  options?: { signals?: string[]; extraSignals?: string[] }
): string[];

export function fetchFullArticle(url: string): Promise<string>;

export function createStorage(dbPath: string): {
  hasProcessed(id: string): boolean;
  markProcessed(item: {
    id: string;
    feedUrl: string;
    title: string;
    link: string;
    publishedAt?: string | null;
  }): void;
  saveAnalysis(
    itemId: string,
    analysis: {
      id: string;
      decision: string;
      confidence: number;
      summary: string;
      impact: string;
      actionItems: string[];
      tags: string[];
    }
  ): void;
  close(): void;
};

export function createAnalyzer(
  config?: AnalyzerConfig
): Promise<(input: { item: ParserFeedItem; context: string }) => Promise<AnalysisResult>>;

// ─── MCP server namespace ────────────────────────────────────────────────────

/**
 * Types for the MCP server entry-point.
 * Import via: import type { McpTool } from 'agentic-rss-parser/mcp'
 */
export * as McpServer from './mcp/server.js';

// ─── Default export ──────────────────────────────────────────────────────────

declare const ParserDefault: typeof Parser;
export default ParserDefault;
