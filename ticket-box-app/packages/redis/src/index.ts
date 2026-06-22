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
