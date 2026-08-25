# Contributing to agentic-rss-parser

Thank you for your interest in contributing to **agentic-rss-parser**!

## Getting Started

1. **Fork and Clone:**
   ```bash
   git clone https://github.com/bluecarbons/agentic-rss-parser.git
   cd agentic-rss-parser
   ```

2. **Install Dependencies:**
   ```bash
   pnpm install
   ```

3. **Run Tests & Linting:**
   ```bash
   pnpm test
   pnpm run lint
   ```

## Development Guidelines

- **Zero Runtime Dependencies:** Production code must maintain zero external dependencies.
- **Node.js Compatibility:** Built for Node `>=22.5.0` (using native `node:sqlite`).
- **Security-First Architecture:** Preserve all XML entity protection, depth limits, prototype pollution sanitization, and SSRF CIDR filters.
- **Testing:** Include unit tests for every bug fix or new feature in `test/`.

## Pull Request Process

1. Create a feature branch: `git checkout -b feat/my-feature`
2. Commit your changes with clear messages following Conventional Commits.
3. Verify that all tests pass: `pnpm test && pnpm run lint`
4. Open a Pull Request against `main`.
