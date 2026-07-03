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

export interface ParserOptions {
  customFields?: CustomFieldConfig;
  defaultRSS?: number | string;
  headers?: Record<string, string>;
  userAgent?: string;
  timeout?: number;
  maxRedirects?: number;
  requestOptions?: Record<string, unknown>;
  normalize?: boolean;
}

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

export interface AnalysisResult {
  decision: 'relevant' | 'ignore';
  confidence: number;
  summary: string;
  impact: string;
  actionItems: string[];
  tags: string[];
}

export interface FeedError {
  feedUrl: string;
  error: string;
}

export interface FeedResultsArray<Item = ParserFeedItem> extends Array<{ item: Item; analysis: AnalysisResult }> {
  feedErrors?: FeedError[];
}

export interface AgenticParserResult {
  results: FeedResultsArray;
  feedErrors: FeedError[];
}

export interface StorageAnalysisRow {
  id: string;
  item_id: string;
  decision: 'relevant' | 'ignore';
  confidence: number;
  summary: string;
  impact: string;
  actionItems: string[];
  tags: string[];
  created_at: string;
  feed_url: string;
  title: string;
  link: string | null;
  published_at: string | null;
  processed_at: string;
}

export interface GetAnalysesOptions {
  feedUrl?: string;
  decision?: 'relevant' | 'ignore';
  limit?: number;
  offset?: number;
}

export interface StorageAdapter {
  hasProcessed(id: string): boolean;
  markProcessed(item: {
    id: string;
    feedUrl: string;
    title: string;
    link: string;
    publishedAt?: string | null;
    processedAt?: string;
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
  getAnalyses(opts?: GetAnalysesOptions): StorageAnalysisRow[];
  pruneOlderThan(ttlDays: number): { deletedItems: number; deletedAnalyses: number };
  close(): void;
}

export interface AnalyzerConfig {
  provider?: 'heuristic' | 'openai' | 'anthropic' | 'local';
  model?: string;
  apiKey?: string;
  baseURL?: string;
  signals?: string[];
  extraSignals?: string[];
  threshold?: number;
}

export interface AgenticParserConfig {
  feedUrls: string[];
  dbPath?: string;
  storage?: StorageAdapter;
  fetchFullArticle?: boolean;
  concurrency?: number;
  maxItems?: number;
  parserOptions?: ParserOptions;
  analyzer?: (input: { item: ParserFeedItem; context: string }) => unknown;
  model?: AnalyzerConfig;
}

export interface ParseFeedConfig {
  dbPath?: string;
  storage?: StorageAdapter;
  fetchFullArticle?: boolean;
  concurrency?: number;
  maxItems?: number;
  analyzer?: (input: { item: ParserFeedItem; context: string }) => unknown;
  model?: AnalyzerConfig;
}

export class Parser<Feed = unknown, Item = ParserFeedItem> {
  constructor(options?: ParserOptions);
  parseURL(url: string): Promise<ParserFeed<Feed, Item>>;
  parseURL(url: string, callback: ParserCallback<ParserFeed<Feed, Item>>): void;
  parseString(xml: string): Promise<ParserFeed<Feed, Item>>;
  parseString(xml: string, callback: ParserCallback<ParserFeed<Feed, Item>>): void;
  parseFile(path: string): Promise<ParserFeed<Feed, Item>>;
  parseFile(path: string, callback: ParserCallback<ParserFeed<Feed, Item>>): void;
  parseFeed(
    urls: string | string[],
    config?: ParseFeedConfig
  ): Promise<FeedResultsArray<Item>>;
}

export function createParser<Feed = unknown, Item = ParserFeedItem>(
  options?: ParserOptions
): Parser<Feed, Item>;

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

export function heuristicAnalyze(
  item: ParserFeedItem,
  context?: string,
  options?: {
    signals?: string[];
    extraSignals?: string[];
    threshold?: number;
  }
): AnalysisResult;

export const DEFAULT_HEURISTIC_SIGNALS: string[];
export function resolveSignals(
  options?: { signals?: string[]; extraSignals?: string[] }
): string[];
export function fetchFullArticle(url: string): Promise<string>;
export function createStorage(dbPath: string): StorageAdapter;
export function createMemoryStorage(): StorageAdapter;
export function createAnalyzer(
  config?: AnalyzerConfig
): Promise<(input: { item: ParserFeedItem; context: string }) => Promise<AnalysisResult>>;

export * as McpServer from './mcp/server.js';

declare const ParserDefault: typeof Parser;
export default ParserDefault;
