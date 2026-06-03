export { getInstance, disconnect } from './redis.js';
export { cacheGet, cacheSet, cacheDelete, getSetNX } from './cache.js';
export { cacheGet as get, cacheSet as set, cacheDelete as del } from './cache.js';
export type { RedisValue, CacheOptions } from './types.js';
