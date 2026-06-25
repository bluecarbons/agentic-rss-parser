import { fetchFullArticle } from './fetch-article.js';

function validateAnalysis(result) {
  const decision = result?.decision === 'relevant' ? 'relevant' : 'ignore';
  const confidence = Number.isFinite(result?.confidence)
    ? Math.max(0, Math.min(100, Math.trunc(result.confidence)))
    : 0;
  const summary =
    typeof result?.summary === 'string' && result.summary.trim()
      ? result.summary.trim()
      : 'No summary provided.';
  const impact =
    typeof result?.impact === 'string' && result.impact.trim()
      ? result.impact.trim()
      : 'No impact provided.';
  const actionItems = Array.isArray(result?.actionItems)
    ? result.actionItems
        .filter((item) => typeof item === 'string' && item.trim())
        .map((item) => item.trim())
    : [];
  const tags = Array.isArray(result?.tags)
    ? [
        ...new Set(
          result.tags
            .filter((tag) => typeof tag === 'string' && tag.trim())
            .map((tag) => tag.trim())
        )
      ]
    : [];

  return { decision, confidence, summary, impact, actionItems, tags };
}

export const AnalysisSchema = {
  parse(result) {
    return validateAnalysis(result);
  }
};

/**
 * Built-in heuristic signals — developer/tech-tool focused.
 *
 * These are intentionally general so the zero-config experience is useful
 * out of the box for technical feeds. Users should override via:
 *
 *   signals:      ['your', 'domain', 'keywords']  // replaces defaults entirely
 *   extraSignals: ['funding', 'launch']            // appended to defaults
 *
 * in their ParserOptions / AgenticParserConfig.
 */
export const DEFAULT_HEURISTIC_SIGNALS = [
  'release',
  'security',
  'vulnerability',
  'node',
  'javascript',
  'typescript',
  'framework',
  'api',
  'breaking',
  'performance',
  'agent',
  'rss'
];

/**
 * Resolve the effective signal list from user-supplied options.
 *
 * Priority (highest to lowest):
 *   1. options.signals      — full replacement array
 *   2. options.extraSignals — appended to DEFAULT_HEURISTIC_SIGNALS
 *   3. DEFAULT_HEURISTIC_SIGNALS — used as-is when neither is supplied
 *
 * Deduplication and lowercasing are applied so the caller never needs
 * to worry about case or duplicate entries.
 *
 * @param {{ signals?: string[], extraSignals?: string[] }} [options]
 * @returns {string[]}
 */
export function resolveSignals(options = {}) {
  if (Array.isArray(options.signals) && options.signals.length > 0) {
    return [...new Set(options.signals.map((s) => String(s).toLowerCase().trim()).filter(Boolean))];
  }
  const base = [...DEFAULT_HEURISTIC_SIGNALS];
  if (Array.isArray(options.extraSignals) && options.extraSignals.length > 0) {
    const extra = options.extraSignals.map((s) => String(s).toLowerCase().trim()).filter(Boolean);
    return [...new Set([...base, ...extra])];
  }
  return base;
}

/**
 * Heuristic signal-based analyser — no LLM required.
 *
 * Exported so adapters/provider.js can delegate to this as the single
 * source of truth for the heuristic provider, avoiding duplicated logic.
 *
 * @param {{ title?: string, contentSnippet?: string }} item
 * @param {string} [context]
 * @param {{ signals?: string[], extraSignals?: string[] }} [options]
 * @returns {{ decision: 'relevant'|'ignore', confidence: number, summary: string, impact: string, actionItems: string[], tags: string[] }}
 */
export function heuristicAnalyze(item, context, options = {}) {
  const signals = resolveSignals(options);
  const text = `${item.title ?? ''}\n${item.contentSnippet ?? ''}\n${context ?? ''}`.toLowerCase();
  const score = signals.reduce(
    (total, signal) => total + (text.includes(signal) ? 1 : 0),
    0
  );
  const threshold = options.threshold ?? 3;
  const confidence = Math.min(95, 35 + score * 10);
  const decision = score >= threshold ? 'relevant' : 'ignore';
  return validateAnalysis({
    decision,
    confidence,
    summary:
      decision === 'relevant'
        ? `Likely worth reading: ${item.title}`
        : `Low-signal item: ${item.title}`,
    impact:
      decision === 'relevant'
        ? 'Could affect engineering decisions or tooling.'
        : 'Probably noise for a technical feed.',
    actionItems:
      decision === 'relevant'
        ? ['Review the source article.', 'Share with the relevant team if actionable.']
        : [],
    tags: [...new Set(signals.filter((signal) => text.includes(signal)).slice(0, 5))]
  });
}

export async function analyzeFeedItem(item, options = {}) {
  // CORRECTNESS: check .trim() so an empty-string contentSnippet (which is
  // falsy but technically present) still triggers article fetching when
  // fetchFullArticle is enabled. Without .trim(), '' would suppress the fetch
  // and the item would be analysed with no context at all.
  const hasContent = Boolean(item.contentSnippet?.trim());
  const shouldFetch = Boolean(options.fetchFullArticle) && !hasContent;
  const context = shouldFetch
    ? await fetchFullArticle(item.link)
    : (item.contentSnippet ?? item.content ?? '');

  if (typeof options.analyzer === 'function') {
    const result = await options.analyzer({ item, context });
    return validateAnalysis(result);
  }

  return heuristicAnalyze(item, context, options);
}

export { validateAnalysis };
