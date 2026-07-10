/**
 * index.ts — Public API của @ticketbox/redis package.
 */

export { createRedisClient, getRedisClient, closeRedis } from "./client.js";
export {
  cacheGet,
  cacheSet,
  cacheDelete,
  cacheDeletePattern,
  cacheAside,
  cacheSingleFlight,
  getSetNX,
} from "./cache.js";
export {
  getIdempotencyResponse,
  setIdempotencyResponse,
  acquireIdempotencyClaim,
  releaseIdempotencyClaim,
  addToDenylist,
  isTokenRevoked,
  type IdempotencyRecord,
} from "./idempotency.js";
export {
  setOtp,
  getOtp,
  deleteOtp,
  checkResendCooldown,
  setResendCooldown,
} from "./otp.js";
export {
  catalogCacheKeys,
  catalogCacheTtlSeconds,
  invalidateConcertListCache,
  invalidateConcertCache,
  invalidateSeatMapCache,
  invalidateTicketTypeCache,
} from "./catalog-cache.js";
export {
  acquireSemaphore,
  releaseSemaphore,
  type SemaphoreLease,
  type SemaphoreAcquireResult,
} from "./semaphore.js";
