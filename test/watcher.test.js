import test from 'node:test';
import assert from 'node:assert/strict';
import { createFeedWatcher } from '../src/watcher.js';
import { createMemoryStorage } from '../src/storage.js';

test('createFeedWatcher — polls feed and emits events', async () => {
  const storage = createMemoryStorage();
  const watcher = createFeedWatcher({
    feedUrls: ['https://news.ycombinator.com/rss'],
    intervalMs: 5000,
    storage
  });

  assert.equal(watcher.isRunning, false);

  let pollEventEmitted = false;
  watcher.on('poll', (data) => {
    pollEventEmitted = true;
    assert.ok(Array.isArray(data.results));
    assert.ok(data.timestamp);
  });

  watcher.start();
  assert.equal(watcher.isRunning, true);

  await watcher.pollNow();
  assert.equal(pollEventEmitted, true);

  watcher.stop();
  assert.equal(watcher.isRunning, false);
});
