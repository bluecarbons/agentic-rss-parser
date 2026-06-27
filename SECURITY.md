# Security Policy

## Supported Versions

Only the latest release on `main` is actively supported with security fixes.

| Version | Supported |
|---|---|
| `1.2.x` (current) | ✅ Yes |
| `1.1.x` | ⚠️ Critical fixes only |
| `< 1.1.0` | ❌ No |

---

## Security Architecture

**Agentic RSS Parser** was designed from v1.0.8 onwards with an explicit security-first stance.

### XML Parsing — XXE and Billion Laughs

The custom XML engine (`src/core/parser.js`) is a non-recursive, character-by-character state machine:

- **No DOCTYPE / ENTITY expansion** — both are silently ignored, making XXE (XML External Entity) attacks structurally impossible.
- **No recursive descent** — deeply nested XML trees do not cause stack overflows.
- **Billion Laughs immune** — without entity expansion, recursive entity references cannot amplify into memory exhaustion.

### HTTP Layer

`src/core/http.js` enforces several protections on all outbound requests:

- **Protocol allowlist** — only `http:` and `https:` are accepted. `file://`, `javascript://`, `ftp://`, and all other schemes are rejected before any network call (prevents SSRF and local file inclusion).
- **Redirect cap** — maximum 5 redirects followed; subsequent redirects throw an error (prevents redirect-loop amplification).
- **Timeout** — all requests time out after 10 seconds by default (configurable via `options.timeout`).
- **Response size cap** — feed responses are hard-capped at 5 MB. The cap is checked against `Content-Length` (fast path) and re-checked after buffering chunked responses, preventing OOM via large or malicious payloads.
- **User-Agent override** — the `userAgent` option (v1.2.0+) allows callers to override the default UA. This is intentional and documented; it is not a security bypass.
- **Deployment note** — for multi-tenant or user-supplied URL workflows, place this library behind your own proxy or allowlist layer. The package validates schemes and common private/loopback targets, but DNS-rebinding defenses belong at the deployment boundary where you control DNS resolution and egress policy.

### LLM Prompt Injection

`src/adapters/provider.js` sanitises all feed content before interpolating it into LLM prompts:

- ASCII control characters (`\x00`–`\x1F` excluding space) are stripped.
- Newlines are collapsed to spaces, preventing role-boundary injection sequences such as `\nAssistant: ignore all previous instructions`.
- Titles are capped at 500 characters; snippets at 2,000 characters; expanded context at 3,000 characters.

### XSS Mitigation

`src/core/parser.js` strips the following tags from `contentSnippet` during HTML-to-text extraction:
`<script>`, `<style>`, `<iframe>`, `<object>`, `<embed>`, `<form>`, `<input>`, `<button>`.

This mitigates XSS if `contentSnippet` is rendered as HTML by a downstream consumer.

### LLM Provider Security

- **API key validation** — explicit check before any network call. An empty or missing key throws a clear error rather than sending a blank `Bearer ` token.
- **Provider allowlist** — `SUPPORTED_PROVIDERS` in `provider.js` and `ALLOWED_PROVIDERS` in `mcp/server.js` reject unknown provider strings before they reach env-var access or network dispatch.
- **Response size cap** — LLM API responses are capped at 1 MB before parsing.
- **API keys never logged** — keys are read from env or config and forwarded only to the official provider endpoint. They are never written to disk, logs, or any secondary destination.

### MCP Server

- **Input validation** — all `tools/call` arguments are validated before use. A non-string or empty `url` returns JSON-RPC `-32602 Invalid params`.
- **Provider allowlist enforced per call** — an untrusted MCP caller cannot supply an arbitrary `provider` string to reach internal dispatch.
- **No persistent state across calls** — each tool call is stateless; no session data is retained between requests.

### Supply-Chain

- **Intentional dependency surface** — the package keeps its direct dependencies small and explicit so reviewers can audit the exact runtime surface. It is not dependency-free.
- **`socket.dev` findings** — outbound network calls and provider endpoint strings are intentional and documented. The code avoids direct environment-variable reads in the provider layer.
- **Network access is explicit** — feed fetching and optional provider analysis require outbound HTTP requests by design. These are restricted to documented HTTP/HTTPS endpoints, validated before use, and capped for size and redirects.

### Heuristic Thresholds

- **Threshold guidance** — short feeds with little or no description text may need `fetchFullArticle: true` or a lower `threshold` to avoid over-filtering. The default threshold is intentionally conservative for technical feeds.

---

## Reporting a Vulnerability

Please **do not open a public GitHub issue** for security vulnerabilities.

1. Email **security@bluecarbons.io** with the subject line `[agentic-rss-parser] Security Vulnerability`.
2. Include:
   - A description of the vulnerability and its impact.
   - Steps to reproduce or a proof-of-concept.
   - The affected version(s).
3. You will receive an acknowledgement within **48 hours** and a patch timeline within **7 days**.

---

## Disclosure Policy

- We follow **coordinated disclosure**: fixes are prepared and released before public disclosure.
- CVEs are filed where appropriate.
- The [CHANGELOG.md](./CHANGELOG.md) documents all security fixes under a `### Security` heading with the exact file and line-level description of the fix.
