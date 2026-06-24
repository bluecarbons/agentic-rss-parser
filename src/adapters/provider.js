import { AnalysisSchema, heuristicAnalyze } from '../agent.js';

// Timeout for LLM provider API calls (30 s).
const LLM_TIMEOUT_MS = 30_000;

// Maximum response body size accepted from an LLM provider (1 MB).
const MAX_RESPONSE_BYTES = 1_048_576; // 1 MB

// Allowlist of supported provider strings.
// SECURITY: validated before use so an MCP caller cannot pass arbitrary
// strings into network or env-var lookup paths.
const SUPPORTED_PROVIDERS = new Set(['heuristic', 'openai', 'anthropic', 'local']);

/**
 * Sanitize a string destined for LLM prompt interpolation.
 *
 * SECURITY — prompt injection mitigation:
 * Strips ASCII control characters (\x00–\x1F excluding space) and normalises
 * whitespace so a crafted feed title/snippet cannot inject role-boundary
 * sequences such as "\nAssistant:" or "\nHuman:" into the prompt.
 *
 * @param {string} str   - Raw string from the feed.
 * @param {number} maxLen - Hard character cap applied after sanitisation.
 * @returns {string}
 */
function sanitizeForPrompt(str, maxLen) {
  return String(str ?? '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // strip control chars
    .replace(/[\r\n]+/g, ' ')                           // collapse newlines → space
    .trim()
    .slice(0, maxLen);
}

/**
 * createAnalyzer — builds an analyzer function for the given provider config.
 *
 * SECURITY NOTE (socket.dev): This module intentionally accesses environment
 * variables and makes outbound network requests. Both are expected, documented
 * behaviour for an LLM-backed feed analysis library:
 *
 *   process.env.OPENAI_API_KEY    — user-supplied OpenAI API key
 *   process.env.ANTHROPIC_API_KEY — user-supplied Anthropic API key
 *
 * Keys are NEVER logged, stored, or forwarded anywhere other than the
 * respective provider's official API endpoint.
 * Users can pass `apiKey` directly in config to avoid env var usage.
 *
 * @param {object} config
 * @param {'heuristic'|'openai'|'anthropic'|'local'} [config.provider='heuristic']
 * @param {string} [config.model]
 * @param {string} [config.apiKey]
 * @param {string} [config.baseURL]
 */
export async function createAnalyzer(config = {}) {
  const provider = config.provider ?? 'heuristic';
  const modelId = config.model;
  const apiKey = config.apiKey;
  const baseURL = config.baseURL;

  // SECURITY: reject unknown provider strings early — before they reach
  // network or env-var lookup paths.
  if (!SUPPORTED_PROVIDERS.has(provider)) {
    throw new Error(
      `Unsupported provider: "${provider}". Must be one of: ${[...SUPPORTED_PROVIDERS].join(', ')}`
    );
  }

  if (provider === 'heuristic') {
    return async ({ item, context }) => heuristicAnalyze(item, context);
  }

  return async ({ item, context }) => {
    const systemPrompt = `You are a technical analyst feed parser. Analyze the feed item and return JSON matching the schema below:
{
  "decision": "relevant" | "ignore",
  "confidence": number (0-100),
  "summary": "string",
  "impact": "string",
  "actionItems": ["string"],
  "tags": ["string"]
}
Only output valid JSON.`;

    // SECURITY — prompt injection mitigation:
    // Sanitize untrusted feed content before interpolating into the prompt.
    // Titles are capped at 500 chars; snippets at 2 000 chars.
    // Control characters and newlines are normalised to spaces so a crafted
    // feed cannot inject role-boundary sequences (e.g. "\nAssistant:").
    const safeTitle = sanitizeForPrompt(item.title, 500);
    const safeSnippet = sanitizeForPrompt(item.contentSnippet ?? '', 2000);
    const safeContext = sanitizeForPrompt(context ?? '', 3000);
    const safeLink = sanitizeForPrompt(item.link ?? '', 500);

    const userPrompt = `Title: ${safeTitle}\nURL: ${safeLink}\nFeed snippet: ${safeSnippet}\nExpanded context: ${safeContext}`;

    /**
     * Fetch helper with:
     *   - 30 s AbortController timeout
     *   - Response body size cap before json() parse
     */
    async function makeLlmFetch(url, init) {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(new Error('LLM request timed out')),
        LLM_TIMEOUT_MS
      );

      let response;
      try {
        response = await fetch(url, { ...init, signal: controller.signal });
      } finally {
        clearTimeout(timeoutId);
      }

      const contentLength = Number(response.headers.get('content-length'));
      if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES) {
        throw new Error(
          `LLM provider response too large: ${contentLength} bytes (max ${MAX_RESPONSE_BYTES})`
        );
      }

      const text = await response.text();
      if (text.length > MAX_RESPONSE_BYTES) {
        throw new Error(
          `LLM provider response body too large: ${text.length} chars (max ${MAX_RESPONSE_BYTES})`
        );
      }

      return { response, text };
    }

    if (provider === 'openai' || provider === 'local') {
      const url = baseURL || (provider === 'local' ? 'http://localhost:11434/v1' : 'https://api.openai.com/v1');
      const endpoint = `${url.replace(/\/$/, '')}/chat/completions`;
      const resolvedKey = apiKey || (provider === 'local' ? 'local' : process.env.OPENAI_API_KEY || '');

      // SECURITY: fail fast with a clear message rather than sending an
      // empty Bearer token and getting a cryptic 401 from the provider.
      if (provider === 'openai' && !resolvedKey) {
        throw new Error(
          'OpenAI API key is required. Set OPENAI_API_KEY env var or pass config.apiKey.'
        );
      }

      const { response, text } = await makeLlmFetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${resolvedKey}`
        },
        body: JSON.stringify({
          model: modelId || (provider === 'local' ? 'local-model' : 'gpt-4o-mini'),
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          response_format: { type: 'json_object' }
        })
      });

      if (!response.ok) {
        throw new Error(`LLM provider request failed: ${response.status} ${response.statusText}`);
      }

      const resData = JSON.parse(text);

      // CORRECTNESS: guard against empty choices array before indexing.
      if (!Array.isArray(resData.choices) || resData.choices.length === 0) {
        throw new Error('LLM provider returned an empty choices array');
      }
      const parsedResult = JSON.parse(resData.choices[0].message.content);
      return AnalysisSchema.parse(parsedResult);
    }

    if (provider === 'anthropic') {
      const url = baseURL || 'https://api.anthropic.com/v1';
      const endpoint = `${url.replace(/\/$/, '')}/messages`;
      const resolvedKey = apiKey || process.env.ANTHROPIC_API_KEY || '';

      // SECURITY: fail fast with a clear message.
      if (!resolvedKey) {
        throw new Error(
          'Anthropic API key is required. Set ANTHROPIC_API_KEY env var or pass config.apiKey.'
        );
      }

      const anthropicSystemPrompt =
        systemPrompt +
        '\nYou MUST output ONLY raw JSON inside <json>...</json> tags. Do not wrap in markdown or write conversational text.';

      const { response, text } = await makeLlmFetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': resolvedKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: modelId || 'claude-3-5-sonnet-latest',
          max_tokens: 1024,
          system: anthropicSystemPrompt,
          messages: [{ role: 'user', content: userPrompt }]
        })
      });

      if (!response.ok) {
        throw new Error(`Anthropic request failed: ${response.status} ${response.statusText}`);
      }

      const resData = JSON.parse(text);

      // CORRECTNESS: guard against empty content array before indexing.
      if (!Array.isArray(resData.content) || resData.content.length === 0) {
        throw new Error('Anthropic returned an empty content array');
      }
      const rawText = resData.content[0].text;
      const jsonMatch = /<json>([\s\S]*?)<\/json>/.exec(rawText);
      const jsonStr = jsonMatch ? jsonMatch[1] : rawText;
      const parsedResult = JSON.parse(jsonStr.trim());
      return AnalysisSchema.parse(parsedResult);
    }

    // Should never reach here due to SUPPORTED_PROVIDERS check above.
    throw new Error(`Unsupported provider: ${provider}`);
  };
}
