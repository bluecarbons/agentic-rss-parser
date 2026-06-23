# GitHub Repository Settings

## About

Suggested description:

Agentic RSS Parser is a from-scratch, zero-dependency Node.js RSS and Atom parser. It preserves rss-parser-style compatibility for migration while adding agentic analysis, deduplication, enrichment, and MCP-ready tooling.

Suggested website:

https://github.com/bluecarbons/agentic-rss-parser

## Topics

- rss
- atom
- parser
- nodejs
- typescript
- mcp
- agentic
- open-source
- automation
- feeds

## Visibility

- public

## Branch Protection

- protect `main`
- require CI passing before merge
- require at least one review
- delete merged branches

## Release Workflow

- merge to `main`
- run `npm test`
- run `npm audit`
- run `npm pack --dry-run`
- run `npm publish --dry-run`
- update `CHANGELOG.md`
- cut GitHub release from the latest `main` commit
