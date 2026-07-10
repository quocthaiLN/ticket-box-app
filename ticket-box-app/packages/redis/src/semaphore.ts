import { randomUUID } from "node:crypto";
import { getRedisClient } from "./client.js";

const ACQUIRE_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local expiresAt = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local token = ARGV[4]

redis.call("ZREMRANGEBYSCORE", key, "-inf", now)
if redis.call("ZCARD", key) >= limit then
  return 0
end

redis.call("ZADD", key, expiresAt, token)
redis.call("PEXPIRE", key, expiresAt - now)
return 1
`;

const RELEASE_SCRIPT = `
return redis.call("ZREM", KEYS[1], ARGV[1])
`;

export type SemaphoreLease = {
  key: string;
  token: string;
};

export type SemaphoreAcquireResult =
  | { status: "ACQUIRED"; lease: SemaphoreLease }
  | { status: "FULL" }
  | { status: "UNAVAILABLE" };

/**
 * Distributed semaphore backed by a Redis sorted set. Each member is a unique
 * lease token and its score is the expiry timestamp, so abandoned slots are
 * removed atomically on the next acquisition.
 */
export async function acquireSemaphore(
  key: string,
  limit: number,
  leaseMs: number,
): Promise<SemaphoreAcquireResult> {
  const client = getRedisClient();
  if (!client) return { status: "UNAVAILABLE" };

  const token = randomUUID();
  const now = Date.now();

  try {
    const acquired = await client.eval(
      ACQUIRE_SCRIPT,
      1,
      key,
      String(now),
      String(now + leaseMs),
      String(limit),
      token,
    );

    return Number(acquired) === 1
      ? { status: "ACQUIRED", lease: { key, token } }
      : { status: "FULL" };
  } catch (err) {
    console.error(`[semaphore] acquire failed for "${key}":`, err);
    return { status: "UNAVAILABLE" };
  }
}

export async function releaseSemaphore(lease: SemaphoreLease): Promise<void> {
  const client = getRedisClient();
  if (!client) return;

  try {
    await client.eval(RELEASE_SCRIPT, 1, lease.key, lease.token);
  } catch (err) {
    // The lease TTL still prevents a permanent capacity leak.
    console.error(`[semaphore] release failed for "${lease.key}":`, err);
  }
}
