import Parser, { runAgenticParser } from '../src/index.js';

const parser = new Parser({
  timeout: 10000,
  headers: { 'user-agent': 'example-app/1.0' }
});

const feed = await parser.parseURL('https://news.ycombinator.com/rss');
console.log(feed.title);
console.log(feed.items.slice(0, 3).map((item) => item.title));

const results = await runAgenticParser({
  feedUrls: ['https://news.ycombinator.com/rss'],
  dbPath: './data/rss-agent.db',
  fetchFullArticle: false
});

console.log(results.length);
