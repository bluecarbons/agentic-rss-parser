/**
 * Shared DEFAULT_DB_PATH resolution — single source of truth.
 *
 * Two-tier strategy:
 *
 *   1. process.cwd()/data/rss-agent.db — when installed as a package
 *      (node_modules/agentic-rss-parser/...) the CWD is the consumer's
 *      project root, so the DB lands next to their own source files.
 *
 *   2. <package-root>/data/rss-agent.db — fallback when running directly
 *      from a clone of this repo (CWD === package root).
 *
 * Previously this logic was copy-pasted identically in both compat.js and
 * mcp/server.js. Any change to the resolution strategy had to be applied
 * in two places, risking drift. Extracting to this module gives a single
 * authoritative definition imported by both consumers.
 */
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
// db-path.js lives at src/core/db-path.js — two levels up from here is the
// package root (the directory that contains package.json).
const PACKAGE_ROOT = join(__dirname, '../..');
const CWD = process.cwd();

export const DEFAULT_DB_PATH =
  CWD === PACKAGE_ROOT || CWD.startsWith(PACKAGE_ROOT + '/')
    ? join(PACKAGE_ROOT, 'data', 'rss-agent.db')
    : join(CWD, 'data', 'rss-agent.db');
