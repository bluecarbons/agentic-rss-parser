import { EventEmitter } from 'node:events';
import { runAgenticParser } from './parser.js';

/**
 * Create a continuous feed watcher event emitter.
 *
 * @param {object} config
 * @param {string[]} config.feedUrls          - Feed URLs to poll.
 * @param {number}   [config.intervalMs=60000] - Polling interval in ms (min 1000).
 * @param {object}   [config.parserOptions]   - Forwarded options or dynamic resolver function.
 * @param {object}   [config.storage]         - Storage adapter instance.
 * @param {string}   [config.dbPath]          - DB path if storage instance isn't passed.
 * @param {boolean}  [config.fetchFullArticle] - Fetch full article body per item.
 * @param {number}   [config.concurrency]     - Max concurrent workers.
 * @param {object}   [config.model]           - Model / analyzer configuration.
 * @param {Function} [config.analyzer]        - Custom analyzer function.
 *
 * Emits events:
 *   'result'     - ({ item, analysis }) for every newly ingested item
 *   'poll'       - ({ results, feedErrors, timestamp }) after each poll cycle completes
 *   'error'      - (err) on unexpected watcher processing errors
 *   'feedError'  - ({ feedUrl, error }) on per-feed fetch/parse errors
 *   'stop'       - () when watcher.stop() is invoked
 */
export function createFeedWatcher(config = {}) {
  if (!Array.isArray(config.feedUrls) || config.feedUrls.length === 0) {
    throw new TypeError('createFeedWatcher requires a non-empty array of feedUrls');
  }

  const emitter = new EventEmitter();
  const intervalMs = Math.max(
    typeof config.intervalMs === 'number' && Number.isFinite(config.intervalMs)
      ? config.intervalMs
      : 60_000,
    1_000
  );

  let timerId = null;
  let isRunning = false;
  let isPolling = false;

  async function poll(force = false) {
    if (isPolling && !force) return;
    isPolling = true;

    try {
      const output = await runAgenticParser({
        feedUrls: config.feedUrls,
        dbPath: config.dbPath,
        storage: config.storage,
        fetchFullArticle: config.fetchFullArticle,
        concurrency: config.concurrency,
        parserOptions: config.parserOptions,
        analyzer: config.analyzer,
        model: config.model
      });

      for (const entry of output.results) {
        emitter.emit('result', entry);
      }

      for (const err of output.feedErrors) {
        emitter.emit('feedError', err);
      }

      emitter.emit('poll', {
        results: output.results,
        feedErrors: output.feedErrors,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      emitter.emit('error', err);
    } finally {
      isPolling = false;
    }
  }

  emitter.start = function start() {
    if (isRunning) return emitter;
    isRunning = true;

    // Immediate first poll cycle
    poll();

    timerId = setInterval(poll, intervalMs);
    if (typeof timerId?.unref === 'function') {
      timerId.unref();
    }
    return emitter;
  };

  emitter.stop = function stop() {
    if (!isRunning) return emitter;
    isRunning = false;
    if (timerId !== null) {
      clearInterval(timerId);
      timerId = null;
    }
    emitter.emit('stop');
    return emitter;
  };

  emitter.pollNow = function pollNow() {
    return poll(true);
  };

  Object.defineProperty(emitter, 'isRunning', {
    get: () => isRunning,
    enumerable: true
  });

  return emitter;
}
