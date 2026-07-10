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

/**
 * In-process inflight map — mỗi entry là một Promise đang fetch DB cho key đó.
 * Tận dụng single-threaded event loop của Node.js: Map.get/set giữa 2 điểm await
 * là atomic, không cần distributed lock hay polling.
 */
const inflightRequests = new Map<string, Promise<unknown>>();

/**
 * Single-flight cache wrapper — chống cache stampede bằng in-process Promise deduplication.
 *
 * Cơ chế hoạt động (tận dụng Node.js single-threaded event loop):
 *   1. GET cache → hit → trả về ngay (zero overhead).
 *   2. Cache miss → kiểm tra inflight map (atomic, không await ở giữa):
 *      a. Đã có Promise đang chạy → await Promise đó → đọc lại cache → trả về.
 *         Không gọi DB thêm lần nào. Không poll, không delay nhân tạo.
 *      b. Chưa có → tạo Promise mới, đăng ký vào map → fetch DB → SET cache → return.
 *   3. Nếu Promise đang chạy gặp lỗi (DB down) → waiter tự fetch DB trực tiếp.
 *
 * Lưu ý:
 * - Dedup chỉ trong phạm vi 1 process. Nếu scale nhiều instance, mỗi instance
 *   vẫn có thể cùng lúc đập DB một lần — chấp nhận được so với N×VU requests.
 * - Redis vẫn được dùng để lưu cache data (GET/SET), chỉ bỏ distributed lock.
 *
 * @param key        Cache key chính.
 * @param fetcher    Hàm fetch dữ liệu từ DB khi cache miss.
 * @param ttlSeconds TTL của cache data (giây). Default 300.
 */
export async function cacheSingleFlight<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): Promise<T> {
  // ── Bước 1: Thử lấy từ cache ──────────────────────────────────────────────
  const cached = await cacheGet<T>(key);
  if (cached !== null) return cached;

  // ── Bước 2: Kiểm tra inflight (ATOMIC — không có await giữa get và set) ───
  // Node.js single-threaded: giữa dòng này và inflightRequests.set() bên dưới,
  // không có code nào khác chạy xen vào, nên tuyệt đối an toàn.
  const existing = inflightRequests.get(key) as Promise<T> | undefined;

  if (existing) {
    // ── 2a. Đã có request đang fetch — chờ nó xong rồi lấy từ cache ─────────
    await existing.catch(() => {
      // Nếu request đang chạy bị lỗi, bỏ qua — sẽ tự fetch ở bước 2b
    });
    const retried = await cacheGet<T>(key);
    if (retried !== null) return retried;
    // Vẫn miss (parallel request thất bại) → tiếp tục tạo request mới ở bước 2b
  }

  // ── 2b. Chưa có (hoặc parallel request vừa thất bại) — tạo Promise mới ────
  const promise = (async (): Promise<T> => {
    const fresh = await fetcher();
    await cacheSet(key, fresh, ttlSeconds);
    return fresh;
  })();

  // Đăng ký vào map TRƯỚC khi await bất kỳ điều gì (atomic với get ở trên)
  inflightRequests.set(key, promise);

  // Dọn map khi promise xong (success hoặc error) — fire-and-forget
  void promise.finally(() => inflightRequests.delete(key));

  return promise;
}
