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
  timeout?: number;
  maxRedirects?: number;
  requestOptions?: Record<string, unknown>;
  xml2js?: Record<string, unknown>;
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
    config?: {
      dbPath?: string;
      fetchFullArticle?: boolean;
      concurrency?: number;
      analyzer?: (input: { item: Item; context: string }) => unknown;
      model?: {
        provider?: 'heuristic' | 'openai' | 'anthropic' | 'local';
        model?: string;
        apiKey?: string;
        baseURL?: string;
      };
    }
  ): Promise<Array<{ item: Item; analysis: unknown }>>;
}

export function createParser<Feed = unknown, Item = ParserFeedItem>(
  options?: ParserOptions
): Parser<Feed, Item>;

export function runAgenticParser(config: {
  feedUrls: string[];
  dbPath: string;
  fetchFullArticle?: boolean;
  concurrency?: number;
  parserOptions?: ParserOptions;
  analyzer?: (input: { item: ParserFeedItem; context: string }) => unknown;
  model?: {
    provider?: 'heuristic' | 'openai' | 'anthropic' | 'local';
    model?: string;
    apiKey?: string;
    baseURL?: string;
  };
}): Promise<Array<{ item: ParserFeedItem; analysis: unknown }>>;

export function analyzeFeedItem(
  item: ParserFeedItem,
  options?: {
    fetchFullArticle?: boolean;
    analyzer?: (input: { item: ParserFeedItem; context: string }) => unknown;
  }
): Promise<{
  decision: 'relevant' | 'ignore';
  confidence: number;
  summary: string;
  impact: string;
  actionItems: string[];
  tags: string[];
}>;

export function fetchFullArticle(url: string): Promise<string>;
export function createStorage(dbPath: string): {
  hasProcessed(id: string): boolean;
  markProcessed(item: { id: string; feedUrl: string; title: string; link: string; publishedAt?: string | null }): void;
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
export function createAnalyzer(config?: {
  provider?: 'heuristic' | 'openai' | 'anthropic' | 'local';
  model?: string;
  apiKey?: string;
  baseURL?: string;
}): Promise<(input: { item: ParserFeedItem; context: string }) => Promise<unknown>>;

declare const ParserDefault: typeof Parser;
export default ParserDefault;
