# Security Policy

## Supported Versions

We support the latest `main` branch and the most recent released version.

## Reporting a Vulnerability

If you discover a security issue, please do not open a public issue.

Instead:

- contact the maintainers privately through the repository's security contact process
- include a clear description of the issue
- include reproduction steps if possible
- include any relevant feed sample or payload, if safe to share

## Security Guidance

- only process feeds from sources you trust
- prefer HTTPS feed URLs
- keep API keys and tokens out of source control
- review custom feed XML before processing untrusted content in production
- validate feed URLs before use and reject non-HTTP protocols
- keep MCP servers on least privilege
- prefer local stdio MCP when possible over exposed remote transports
- do not trust tool descriptions or tool names from unvetted MCP servers
- treat feed content as untrusted input, especially when it can influence agent prompts

## Threat Model Notes

### MITM

When fetching feeds over the network, a man-in-the-middle attacker could tamper with XML, inject malicious links, or alter the feed metadata.

Mitigations:

- use HTTPS whenever possible
- keep request timeouts enabled
- only allow `http:` and `https:` URLs
- avoid logging secrets or credentials from fetched content

### MCP Abuse

MCP is a powerful integration surface and can be abused through prompt injection, tool poisoning, insecure transport, or over-privileged tool access.

Mitigations:

- expose only the tools the agent actually needs
- keep tool descriptions narrow and specific
- validate all tool arguments before execution
- avoid connecting untrusted remote MCP servers to privileged data sources
- prefer explicit user approval for destructive or external side effects
- apply authentication and authorization controls for any remote MCP deployment

### Agent Orchestration

If you embed this package inside an agent framework, the orchestrator should control concurrency and tool invocation. This package intentionally stays focused on feed retrieval, normalization, deduplication, and enrichment.

## Dependency Updates

We review dependency updates regularly and keep the published package audit-clean before release.

## Disclosure

We aim to acknowledge and address confirmed security issues promptly.
