/**
 * index.ts — Public API của @ticketbox/redis package.
 */

export { getRedisClient, closeRedis } from "./client.js";
export { cacheGet, cacheSet, cacheDel, cacheAside } from "./cache.js";
export { cacheGet as get, cacheSet as set, cacheDel as del, cacheDel as cacheDelete } from "./cache.js";
export {
  getIdempotencyResponse,
  setIdempotencyResponse,
  addToDenylist,
  isTokenRevoked,
  type IdempotencyRecord,
} from "./idempotency.js";
