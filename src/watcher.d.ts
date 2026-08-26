import type { FeedWatcher, WatcherConfig } from './index.js';

export { FeedWatcher, WatcherConfig };

export function createFeedWatcher(config: WatcherConfig): FeedWatcher;
