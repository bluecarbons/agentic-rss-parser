# CLI

agentic-rss-parser ships two CLI commands:

| Command | Binary | Description |
|---|---|---|
| `agentic-rss` | `bin/agentic-rss.js` | Parse and analyse feeds from the terminal |
| `agentic-rss-mcp` | `bin/agentic-rss-mcp.js` | Start the MCP stdio server |

## `agentic-rss`

```bash
agentic-rss <url> [url2 ...] [options]
```

### Arguments

| Argument | Description |
|---|---|
| `<url>` | One or more RSS/Atom feed URLs |

### Options

| Flag | Default | Description |
|---|---|---|
| `--provider` | `heuristic` | Analysis provider: `heuristic`, `openai`, `anthropic`, `local` |
| `--limit` | (all) | Max items to output |
| `--fetch-article` | off | Fetch full article body for context |
| `--json` | on | Output as JSON (default) |

### Examples

```bash
# Basic usage — heuristic analysis, JSON output
agentic-rss https://hnrss.org/frontpage

# Multiple feeds at once
agentic-rss https://hnrss.org/frontpage https://blog.nodejs.org/en/feed

# LLM analysis via OpenAI
OPENAI_API_KEY=sk-... agentic-rss https://hnrss.org/frontpage --provider openai

# Limit output to 5 items
agentic-rss https://hnrss.org/frontpage --limit 5

# Local Ollama
agentic-rss https://hnrss.org/frontpage --provider local
```

## `agentic-rss-mcp`

Starts the JSON-RPC 2.0 MCP server over stdio. See [MCP Server](MCP-Server) for full documentation.

```bash
# Direct start
agentic-rss-mcp

# With concurrency override
AGENTIC_RSS_MAX_CONCURRENCY=5 agentic-rss-mcp
```
