export const catalogCacheKeys = {
  list: (queryHash: string) => `catalog:list:${queryHash}`,
  concert: (concertId: string) => `catalog:concert:${concertId}`,
  metadata: (concertId: string) => `catalog:metadata:${concertId}`,
  seatMap: (concertId: string) => `catalog:seat-map:${concertId}`,
  ticketTypes: (concertId: string, includeClosed: boolean) =>
    `catalog:ticket-types:${concertId}:${includeClosed ? "include-closed" : "active"}`,
  inventory: (concertId: string) => `inventory:concert:${concertId}`
};

export const catalogCacheTtlSeconds = {
  list: 300,
  concert: 3600,
  metadata: 86400,
  seatMap: 86400,
  ticketTypes: 300,
  inventory: 5
};
