# Security Policy

### Supported Versions

Only the latest release on `main` is actively supported with security fixes.

| Version | Supported |
|---|---|
| `1.7.x` (current) | ✅ Yes |
| `1.6.x` | ⚠️ Critical fixes only |
| `< 1.6.0` | ❌ No |

---

## Security Architecture

**Agentic RSS Parser** was designed from v1.0.8 onwards with an explicit security-first stance.

### XML Parsing — XXE, Billion Laughs & DoS Mitigation

The custom XML engine (`src/core/parser.js`) is a streaming, character-by-character state machine:

- **No DOCTYPE / ENTITY expansion** — both are silently ignored, making XXE (XML External Entity) attacks structurally impossible.
- **Max nesting depth limit** — `MAX_XML_DEPTH = 128` prevents recursive nesting stack overflow DoS attacks.
- **Safe entity code points** — Unicode entity decoding checks code point validity (`0 <= cp <= 0x10FFFF`) to prevent runtime `RangeError` crashes.
- **Prototype pollution immunity** — node property mapping uses `Object.hasOwn()` and sanitizes dangerous keys (`__proto__`, `constructor`, `prototype`).
- **Billion Laughs immune** — without entity expansion, recursive entity references cannot amplify into memory exhaustion.

### HTTP Layer & SSRF Protection

`src/core/http.js` enforces several protections on all outbound requests:

- **Protocol allowlist** — only `http:` and `https:` are accepted. `file://`, `javascript://`, `ftp://`, and all other schemes are rejected before any network call.
- **Full IANA reserved range blocking** — checks RFC 1918 private IPv4, link-local (`169.254.0.0/16`), loopback (`127.0.0.0/8`), carrier-grade NAT (`100.64.0.0/10`), documentation (`192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24`, `2001:db8::/32`), multicast (`224.0.0.0/4`), reserved Class E (`240.0.0.0/4`), 6to4 (`2002::/16`), and discard (`100::/64`) ranges.
- **DNS resolution check** — `assertResolvedHostSafe()` performs a DNS lookup prior to fetching and verifies that resolved addresses are safe.
- **Redirect cap** — maximum 5 redirects followed; subsequent redirects throw an error.
- **Timeout** — all requests time out after 10 seconds by default (configurable via `options.timeout`).
- **Streaming response size cap** — feed responses are hard-capped at 5 MB and LLM responses at 1 MB using `readBodyWithCap()` to abort oversized streams in real-time.

### LLM Prompt Injection & Custom Analyzers

`src/adapters/provider.js` sanitises feed content before interpolating it into LLM prompts:

- ASCII control characters (`\x00`–`\x1F` excluding space) are stripped.
- Titles are capped at 500 characters; snippets at 2,000 characters; expanded context at 3,000 characters.
- Custom prompts and prompt templates can be supplied via `systemPrompt` and `promptTemplate`.

### MCP Server Security

- **Credential Isolation for Custom Endpoints** — environment API keys (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`) are only used for official standard endpoints. If a custom or untrusted `baseURL` is specified, `args.apiKey` must be explicitly provided by the caller to prevent credential exfiltration.
- **Provider allowlist enforced per call** — untrusted MCP callers cannot supply arbitrary provider strings.
- **No persistent state across calls** — each tool call is stateless; no session data is retained between requests.

### Supply-Chain

- **Zero runtime dependencies** — the package has zero production dependencies. Reviewers can easily audit the entire runtime code surface.
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
