/**
 * idempotency.ts — Helpers cho idempotency key (chống duplicate request).
 *
 * Luồng sử dụng:
 *   1. Client gửi header `Idempotency-Key: <uuid>`.
 *   2. API server gọi `getIdempotencyResponse()` — nếu đã có → trả cached response.
 *   3. Nếu chưa có → xử lý request, gọi `setIdempotencyResponse()` lưu response.
 *
 * Sprint 1: interface stub — thiếu Redis thì miss qua luôn (no-op safe).
 * Sprint 3: middleware idempotency dùng helpers này cho POST /orders và payment webhook.
 */

import { randomUUID } from "node:crypto";
import { getRedisClient } from "./client.js";

const IDEMPOTENCY_TTL_SECONDS = 86_400; // 24 giờ
const KEY_PREFIX = "idempotency:";
const CLAIM_KEY_PREFIX = "idempotency:claim:";

const RELEASE_CLAIM_SCRIPT = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
end
return 0
`;

export type IdempotencyRecord = {
  status: number;
  body: unknown;
  created_at: string;
};

/**
 * Kiểm tra xem idempotency key đã tồn tại và lấy response đã lưu.
 * Trả null nếu chưa có hoặc Redis không khả dụng.
 */
export async function getIdempotencyResponse(
  key: string
): Promise<IdempotencyRecord | null> {
  const client = getRedisClient();
  if (!client) return null;

  try {
    const raw = await client.get(`${KEY_PREFIX}${key}`);
    if (!raw) return null;
    return JSON.parse(raw) as IdempotencyRecord;
  } catch (err) {
    console.error(`[idempotency] GET error for key "${key}":`, err);
    return null;
  }
}

/**
 * Lưu response cho idempotency key với TTL 24h.
 */
export async function setIdempotencyResponse(
  key: string,
  record: IdempotencyRecord
): Promise<void> {
  const client = getRedisClient();
  if (!client) return;

  try {
    await client.set(
      `${KEY_PREFIX}${key}`,
      JSON.stringify(record),
      "EX",
      IDEMPOTENCY_TTL_SECONDS
    );
  } catch (err) {
    console.error(`[idempotency] SET error for key "${key}":`, err);
  }
}

/**
 * Claim an idempotency key before running its handler. `null` means another
 * request owns the claim; `undefined` means Redis is unavailable and callers
 * should rely on the database uniqueness fallback.
 */
export async function acquireIdempotencyClaim(
  key: string,
  ttlSeconds = 60,
): Promise<string | null | undefined> {
  const client = getRedisClient();
  if (!client) return undefined;

  const token = randomUUID();
  try {
    const result = await client.set(
      `${CLAIM_KEY_PREFIX}${key}`,
      token,
      "EX",
      ttlSeconds,
      "NX",
    );
    return result === "OK" ? token : null;
  } catch (err) {
    console.error(`[idempotency] claim error for key "${key}":`, err);
    return undefined;
  }
}

export async function releaseIdempotencyClaim(
  key: string,
  token: string,
): Promise<void> {
  const client = getRedisClient();
  if (!client) return;

  try {
    await client.eval(
      RELEASE_CLAIM_SCRIPT,
      1,
      `${CLAIM_KEY_PREFIX}${key}`,
      token,
    );
  } catch (err) {
    console.error(`[idempotency] release claim error for key "${key}":`, err);
  }
}

/**
 * Thêm JWT ID vào Redis denylist (dùng cho logout/revoke token).
 * @param jti    JWT ID từ payload
 * @param ttlSec Thời gian còn lại của token (giây)
 */
export async function addToDenylist(jti: string, ttlSec: number): Promise<void> {
  const client = getRedisClient();
  if (!client) {
    console.warn("[idempotency] Redis unavailable — token denylist skipped (logout may not be effective)");
    return;
  }

  try {
    await client.set(`denylist:${jti}`, "1", "EX", ttlSec);
  } catch (err) {
    console.error(`[idempotency] Denylist SET error for jti "${jti}":`, err);
  }
}

/**
 * Kiểm tra JWT ID có trong denylist không (token đã bị revoke).
 */
export async function isTokenRevoked(jti: string): Promise<boolean> {
  const client = getRedisClient();
  if (!client) return false; // fallback: pass-through nếu Redis chưa có

  try {
    const val = await client.get(`denylist:${jti}`);
    return val !== null;
  } catch (err) {
    console.error(`[idempotency] Denylist GET error for jti "${jti}":`, err);
    return false;
  }
}
