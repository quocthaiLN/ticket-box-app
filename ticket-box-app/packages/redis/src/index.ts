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
