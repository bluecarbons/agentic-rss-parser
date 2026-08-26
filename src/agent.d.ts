import type { ParserFeedItem, AnalysisResult } from './index.js';

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
