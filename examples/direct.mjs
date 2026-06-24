/**
 * examples/direct.mjs
 *
 * Minimal programmatic usage of agentic-rss-parser.
 *
 * Run: node examples/direct.mjs
 * Requires: Node.js >= 22.5.0
 */
import Parser, { runAgenticParser } from '../src/index.js';

// --- Standard Parser API (rss-parser-compatible) ---
const parser = new Parser({
  timeout: 10000,
  headers: { 'user-agent': 'example-app/1.0' }
});

const feed = await parser.parseURL('https://news.ycombinator.com/rss');
console.log('Feed title:', feed.title);
console.log('First 3 items:');
for (const item of feed.items.slice(0, 3)) {
  console.log(`  - ${item.title}`);
}

// --- Agentic Pipeline (dedup + heuristic analysis) ---
// runAgenticParser returns { results, feedErrors } — always destructure.
const { results, feedErrors } = await runAgenticParser({
  feedUrls: ['https://news.ycombinator.com/rss'],
  dbPath: './data/rss-agent.db',
  fetchFullArticle: false
});

if (feedErrors.length) {
  console.error('Feed errors:', feedErrors);
}

console.log(`Analysed ${results.length} items.`);
for (const { item, analysis } of results) {
  if (analysis.decision === 'relevant') {
    console.log(`  [relevant] ${item.title}`);
  }
}
