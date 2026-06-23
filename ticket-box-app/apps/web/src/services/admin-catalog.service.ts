import {
  cancelConcert,
  listAdminConcerts,
  listVenues,
  publishConcert,
  type ConcertSummary,
  type Venue,
} from "../lib/api-client";

export type { ConcertSummary, Venue } from "../lib/api-client";

export type AdminCatalogData = {
  venues: Venue[];
  concerts: ConcertSummary[];
};

export async function getAdminCatalogData(): Promise<AdminCatalogData> {
  const [venues, concerts] = await Promise.all([listVenues(), listAdminConcerts()]);
  return { venues, concerts };
}

export async function publishCatalogConcert(concertId: string) {
  await publishConcert(concertId);
}

export async function cancelCatalogConcert(concertId: string) {
  await cancelConcert(concertId);
}
