import { createClient } from 'redis';

type RedisClient = ReturnType<typeof createClient>;

let clientPromise: Promise<RedisClient> | null = null;

export function getInstance(): Promise<RedisClient> {
    if (!clientPromise) {
        clientPromise = (async () => {
            const url = process.env.UPSTASH_REDIS_URL;
            if (!url) throw new Error('UPSTASH_REDIS_URL is not defined');
            const client = createClient({ url });
            client.on('error', (err) => console.error('[Redis] client error:', err));
            await client.connect();
            return client;
        })();
    }
    return clientPromise;
}

export async function disconnect(): Promise<void> {
    if (clientPromise) {
        const client = await clientPromise;
        await client.quit();
        clientPromise = null;
    }
}
