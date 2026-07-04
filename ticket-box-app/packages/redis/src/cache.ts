/**
 * cache.ts — Cache-aside helpers dùng chung.
 * Sprint 1: interface đầy đủ, có fallback khi Redis không khả dụng.
 * Sprint 2+: các module dùng để cache catalog, session, v.v.
 */

import { getRedisClient } from "./client.js";

const DEFAULT_TTL_SECONDS = 300; // 5 phút

/**
 * Lấy giá trị từ cache.
 * @returns Giá trị đã parse hoặc null nếu miss / Redis không khả dụng.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  const client = getRedisClient();
  if (!client) return null;

  try {
    const raw = await client.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.error(`[cache] GET error for key "${key}":`, err);
    return null;
  }
}

/**
 * Lưu giá trị vào cache với TTL.
 * @param ttlSeconds Thời gian sống (giây). Default 300.
 */
export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): Promise<void> {
  const client = getRedisClient();
  if (!client) return;

  try {
    await client.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch (err) {
    console.error(`[cache] SET error for key "${key}":`, err);
  }
}

/**
 * Xóa một hoặc nhiều cache key.
 */
export async function cacheDelete(...keys: string[]): Promise<void> {
  const client = getRedisClient();
  if (!client || keys.length === 0) return;

  try {
    await client.del(...keys);
  } catch (err) {
    console.error(`[cache] DEL error for keys [${keys.join(", ")}]:`, err);
  }
}

/**
 * Cache-aside wrapper: thử lấy từ cache, nếu miss thì gọi fetcher và lưu lại.
 */
export async function cacheAside<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): Promise<T> {
  const cached = await cacheGet<T>(key);
  if (cached !== null) return cached;

  const fresh = await fetcher();
  await cacheSet(key, fresh, ttlSeconds);
  return fresh;
}

/**
 * Xóa tất cả key khớp pattern (dùng SCAN để tránh block Redis).
 * Ví dụ: cacheDeletePattern("catalog:list:*")
 */
export async function cacheDeletePattern(pattern: string): Promise<void> {
  const client = getRedisClient();
  if (!client) return;

  try {
    let cursor = "0";
    const keys: string[] = [];
    do {
      const [nextCursor, batch] = await client.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        200,
      );
      cursor = nextCursor;
      keys.push(...batch);
    } while (cursor !== "0");

    if (keys.length > 0) {
      await client.del(...keys);
    }
  } catch (err) {
    console.error(`[cache] SCAN+DEL error for pattern "${pattern}":`, err);
  }
}

/**
 * Set only if key does not exist.
 * Returns true if value was written.
 */
export async function getSetNX(
  key: string,
  value: unknown,
  ttl?: number,
): Promise<boolean> {
  const client = getRedisClient();

  if (!client) {
    return false;
  }

  const serialized = JSON.stringify(value);

  const result =
    ttl !== undefined
      ? await client.set(key, serialized, "EX", ttl, "NX")
      : await client.set(key, serialized, "NX");

  return result === "OK";
}
