import { getRedisClient } from "@ticketbox/redis";

/**
 * Trả về Redis instance từ @ticketbox/redis để truyền vào Queue/Worker.
 * Throw nếu Redis chưa được cấu hình (REDIS_URL chưa set).
 */
export function getRedisConnection() {
  const client = getRedisClient();
  if (!client) {
    throw new Error(
      "[queue] Redis connection is not available. Set REDIS_URL in your environment.",
    );
  }
  return client;
}
