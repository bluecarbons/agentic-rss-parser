# MCP Server

agentic-rss-parser ships a Model Context Protocol (MCP) server that exposes its feed parsing and article fetching capabilities as tools to any MCP-compatible host (Claude Desktop, Cursor, Cline, custom orchestrators, etc.).

## Starting the server

```bash
# Global install
npm install -g agentic-rss-parser
agentic-rss-mcp

# Local install (from consumer project)
npx agentic-rss-mcp

# Direct from repo clone
pnpm mcp
```

The server communicates over **stdio** using the JSON-RPC 2.0 MCP protocol (version `2024-11-05`).

## Claude Desktop configuration

Add to `~/.config/claude/claude_desktop_config.json` (macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "agentic-rss": {
      "command": "npx",
      "args": ["agentic-rss-mcp"],
      "env": {
        "AGENTIC_RSS_MAX_CONCURRENCY": "3"
      }
    }
  }
}
```

## Available tools

### `fetch_rss_feed`

Fetch and agentically analyse an RSS or Atom feed.

**Parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `url` | `string` | required | RSS or Atom feed URL |
| `limit` | `number` | `10` | Max items to return |
| `provider` | `'heuristic'\|'openai'\|'anthropic'\|'local'` | `'heuristic'` | Analysis backend |

**Returns:** JSON object `{ results, feedErrors }` where `results` is `Array<{ item, analysis }>`.

**Example MCP call:**
```json
{
  "name": "fetch_rss_feed",
  "arguments": {
    "url": "https://hnrss.org/frontpage",
    "limit": 5,
    "provider": "heuristic"
  }
}
```

### `fetch_full_article`

Fetch the full plain-text content of an article URL with HTML stripped. Useful for passing article body as context to a subsequent LLM call.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `url` | `string` | Article URL to fetch |

**Returns:** `{ url, text }` — the URL and plain-text body.

## Throttling

The server limits concurrent tool executions. Beyond the limit, requests queue and are processed in order — the server never rejects them with an error.

| Setting | Default | Override |
|---|---|---|
| Max concurrent tool calls | `3` | `AGENTIC_RSS_MAX_CONCURRENCY` env var |
| Hard cap | `16` | Not configurable |

## `limit` semantics

`limit` controls how many **new** items are stored and returned. Items already in the deduplication store are skipped transparently — they do not count against the limit. This means calling `fetch_rss_feed` twice with `limit=5` on the same feed returns items 1–5 the first time and items 6–10 the second time (assuming at least 10 new items in the feed).

## Error handling

| Scenario | Response |
|---|---|
| Invalid URL | `-32602 Invalid params` |
| Unknown provider string | `-32602 Invalid params` |
| Feed fetch failure | `feedErrors` array in result (not a JSON-RPC error) |
| LLM API key missing | `-32603 Internal error` with descriptive message |
| LLM timeout (30 s) | `-32603 Internal error` |
