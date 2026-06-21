/**
 * client.ts — Redis singleton cho toàn bộ ứng dụng.
 *
 * Có fallback graceful: nếu REDIS_URL không được cấu hình, log warning
 * và không crash app. Các helper sẽ degrade về no-op hoặc miss cache.
 */

import { Redis } from "ioredis";

let _client: Redis | null = null;

export function createRedisClient(): Redis | null {
  const url = process.env.REDIS_URL || "redis://localhost:6379";

  if (!url) {
    console.warn(
      "[redis] REDIS_URL is not set — Redis features will be disabled (cache miss / no denylist)",
    );
    return null;
  }

  const client = new Redis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: false,
  });

  client.on("connect", () => console.log("[redis] Connected"));
  client.on("ready", () => console.log("[redis] Ready"));
  client.on("error", (err: Error) =>
    console.error("[redis] Error:", err.message),
  );
  client.on("close", () => console.warn("[redis] Connection closed"));

  return client;
}

/**
 * Lấy Redis client singleton.
 * Trả null nếu REDIS_URL chưa được cấu hình.
 */
export function getRedisClient(): Redis | null {
  if (_client === null) {
    _client = createRedisClient();
  }
  return _client;
}

/** Đóng kết nối Redis (graceful shutdown). */
export async function closeRedis(): Promise<void> {
  if (_client) {
    await _client.quit();
    _client = null;
    console.log("[redis] Connection closed");
  }
}
