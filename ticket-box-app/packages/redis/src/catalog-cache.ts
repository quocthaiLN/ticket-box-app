import { cacheDelete, cacheDeletePattern } from "./cache.js";

export const catalogCacheKeys = {
  list: (queryHash: string) => `catalog:list:${queryHash}`,
  concert: (concertId: string) => `catalog:concert:${concertId}`,
  metadata: (concertId: string) => `catalog:metadata:${concertId}`,
  seatMap: (concertId: string) => `catalog:seat-map:${concertId}`,
  ticketTypes: (concertId: string, includeClosed: boolean) =>
    `catalog:ticket-types:${concertId}:${includeClosed ? "include-closed" : "active"}`,
  inventory: (concertId: string) => `inventory:concert:${concertId}`,
};

export const catalogCacheTtlSeconds = {
  list: 300,
  concert: 3600,
  metadata: 86400,
  seatMap: 86400,
  ticketTypes: 300,
  inventory: 5,
};

export async function invalidateConcertListCache(): Promise<void> {
  await cacheDeletePattern("catalog:list:*").catch((err) =>
    console.error("[catalog-cache] list invalidation error:", err),
  );
}

export async function invalidateConcertCache(concertId: string): Promise<void> {
  await Promise.allSettled([
    cacheDelete(catalogCacheKeys.concert(concertId)),
    cacheDelete(catalogCacheKeys.metadata(concertId)),
    cacheDelete(catalogCacheKeys.seatMap(concertId)),
    cacheDelete(catalogCacheKeys.ticketTypes(concertId, false)),
    cacheDelete(catalogCacheKeys.ticketTypes(concertId, true)),
    cacheDelete(catalogCacheKeys.inventory(concertId)),
    cacheDeletePattern("catalog:list:*"),
  ]);
}

export async function invalidateSeatMapCache(concertId: string): Promise<void> {
  await cacheDelete(catalogCacheKeys.seatMap(concertId)).catch((err) =>
    console.error("[catalog-cache] seat map invalidation error:", err),
  );
}

export async function invalidateTicketTypeCache(concertId: string): Promise<void> {
  await Promise.allSettled([
    cacheDelete(catalogCacheKeys.ticketTypes(concertId, false)),
    cacheDelete(catalogCacheKeys.ticketTypes(concertId, true)),
    cacheDelete(catalogCacheKeys.inventory(concertId)),
  ]);
}
