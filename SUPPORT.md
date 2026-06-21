# Supported Environments

Agentic RSS Parser is supported on:

- Node.js `>=22.5.0`
- ESM modules only
- Linux, macOS, and Windows

Why this matters:

- the codebase depends on the built-in `node:sqlite` module
- `node:sqlite` was introduced in Node.js 22.5.0
- Node.js 20 is not supported for this package

Recommended CI matrix:

- Node.js 22.x
- Node.js 24.x

These are the versions validated by the repository CI workflow.

Recommended local setup:

- use `npm install`
- run `npm test` before opening a pull request
