import type {
  StorageAdapter,
  StorageAnalysisRow,
  GetAnalysesOptions,
  FeedCacheData,
  StorageStatistics
} from './index.js';

export {
  StorageAdapter,
  StorageAnalysisRow,
  GetAnalysesOptions,
  FeedCacheData,
  StorageStatistics
};

export function createStorage(dbPath: string): StorageAdapter;
export function createMemoryStorage(): StorageAdapter;
