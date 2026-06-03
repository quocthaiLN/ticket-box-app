export type RedisValue = string | number | boolean | object | null;

export interface CacheOptions {
    ttl?: number;
}
