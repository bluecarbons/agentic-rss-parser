# Security Policy

## Supported Versions

We support the latest `main` branch and the most recent released version.

## Reporting a Vulnerability

If you discover a security issue, please do not open a public issue.

Instead:
- Contact the maintainers privately through the repository's security contact process.
- Include a clear description of the issue, reproduction steps, and any relevant feed sample or payload.

---

## Security Architecture

Agentic RSS Parser is built with a **zero-dependency** runtime architecture. This drastically reduces the package's attack surface and makes it naturally resilient against common supply-chain attacks.

### 1. Supply Chain & Dependency Security
- **Zero Runtime Dependencies**: The package specifies `{}` under `dependencies` in `package.json`. There are no production transitive dependencies, eliminating risks of compromised downstream packages, unmaintained library bloat, and package-squatting.
- **Strict devDependencies Checks**: Development-only tools (such as test runners and linters) are regularly checked for vulnerabilities using `npm audit`.

### 2. Custom XML Parser Hardening
The XML engine (`src/core/parser.js`) is written from scratch using a character-by-character scanner:
- **No Entity Expansion**: The parser does not expand XML entities or process DTDs (Document Type Definitions). This guarantees complete immunity against **XML External Entity (XXE)** injections and **Billion Laughs (XML bomb)** denial-of-service attacks.
- **Iteration over Recursion**: Parsing nested elements is handled iteratively rather than recursively. This protects the runtime from call-stack exhaustion (Stack Overflow DoS) even when parsing extremely deep XML documents.
- **Graceful Error Handling**: Malformed or incomplete XML strings degrade gracefully without throwing fatal errors or causing process crashes.

### 3. Cross-Site Scripting (XSS) Mitigation
- Feed entries can contain rich HTML or `<script>` tags in their content fields. The parser's normalization routines strip dangerous tags (like `<script>` elements and script payloads) when compiling summaries/snippets.
- Feed consumers should still treat all parsed content as untrusted input and apply appropriate sanitization/escaping before rendering in web browsers.

### 4. HTTP & URL Sanitization
- The HTTP retrieval layer validates URLs before initiating fetches.
- **Protocol Allowlist**: Only `http:` and `https:` URLs are processed. System/file-level protocols (such as `file://`, `ftp://`, or `javascript://`) are immediately rejected to prevent **Server-Side Request Forgery (SSRF)** and **Local File Inclusion (LFI)**.
- **Timeout Controls**: Request timeouts are strictly enforced by default to prevent hanging network calls from tying up process resources.

### 5. Model Context Protocol (MCP) Server Security
- The built-in MCP server operates entirely over standard input/output (`stdio`) using a custom JSON-RPC parser.
- **JSON-RPC Conformance**: The server enforces schema validation and strictly structured JSON envelopes. Invalid payloads or unknown procedures return standard JSON-RPC 2.0 error codes without exposing stack traces.

---

## Deployment Best Practices

- **API Key Management**: When utilizing LLM adapters, load API keys via environment variables (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`) or secure secret managers. Never hardcode keys in source code.
- **Least Privilege**: Run MCP servers and parser processes with the minimum OS privileges necessary.
- **Feed Validation**: If allowing end-users to input feed URLs, enforce DNS/IP resolution filtering (e.g., preventing access to private local ranges like `127.0.0.1` or `192.168.x.x`) at the network layer.
