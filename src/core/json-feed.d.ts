import type { ParserOptions, ParserFeed, ParserFeedItem } from '../index.js';

export function isJsonFeed(content: string | object): boolean;

export function parseJsonFeed<Feed = unknown, Item = ParserFeedItem>(
  input: string | object,
  options?: ParserOptions
): ParserFeed<Feed, Item>;
