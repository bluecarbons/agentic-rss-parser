# GitHub Repository Settings

## About

Suggested description:

Agentic RSS Parser is a from-scratch Node.js RSS and Atom parser built on fast-xml-parser. It preserves rss-parser-style compatibility for migration while adding agentic analysis, deduplication, enrichment, and MCP-ready tooling.

Suggested website:

https://github.com/bluecarbons/BLUECARBONS-RSS-PARSER

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
- update `CHANGELOG.md`
- cut GitHub release from the latest `main` commit
