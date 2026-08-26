import type { ParserOptions, ParserFeed, ParserFeedItem } from '../index.js';

export { ParserOptions, ParserFeed, ParserFeedItem };

export interface Enclosure {
  url: string;
  type?: string;
  length?: string;
}

export interface MediaThumbnail {
  thumbnail: string;
  medium?: string;
}

export interface ItunesPodcastData {
  duration?: string;
  episode?: string;
  author?: string;
  image?: string;
  summary?: string;
}

export function parseXml(xml: string): Record<string, unknown>;

export function parseFeedXml<Feed = unknown, Item = ParserFeedItem>(
  xml: string,
  options?: ParserOptions
): ParserFeed<Feed, Item>;

export function parseFeedString<Feed = unknown, Item = ParserFeedItem>(
  xml: string,
  options?: ParserOptions
): ParserFeed<Feed, Item>;

export function stripHtml(html?: string): string;
