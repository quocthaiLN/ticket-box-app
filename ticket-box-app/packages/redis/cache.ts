import { getInstance } from './redis.js';
import type { RedisValue } from './types.js';

export async function cacheGet<T = RedisValue>(key: string): Promise<T | null> {
    const client = await getInstance();
    const raw = await client.get(key);
    if (raw === null) return null;
    try {
        return JSON.parse(raw) as T;
    } catch {
        return raw as unknown as T;
    }
}

export async function cacheSet(key: string, value: RedisValue, ttl?: number): Promise<void> {
    const client = await getInstance();
    const serialized = JSON.stringify(value);
    if (ttl) {
        await client.set(key, serialized, { EX: ttl });
    } else {
        await client.set(key, serialized);
    }
}

export async function cacheDelete(key: string): Promise<void> {
    const client = await getInstance();
    await client.del(key);
}

// Sets key only if it does not exist. Returns true if set, false if key already existed.
export async function getSetNX(key: string, value: RedisValue, ttl?: number): Promise<boolean> {
    const client = await getInstance();
    const serialized = JSON.stringify(value);
    if (ttl) {
        const result = await client.set(key, serialized, { NX: true, EX: ttl });
        return result === 'OK';
    }
    return client.setNX(key, serialized);
}
