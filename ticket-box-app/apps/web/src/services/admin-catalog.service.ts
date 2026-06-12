import {
  createConcert,
  createSeatZone,
  createTicketType,
  createVenue,
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

export type CreateVenueInput = Omit<Venue, "id">;

export async function getAdminCatalogData(): Promise<AdminCatalogData> {
  const [venues, concerts] = await Promise.all([listVenues(), listAdminConcerts()]);
  return { venues, concerts };
}

export function createCatalogVenue(input: CreateVenueInput) {
  return createVenue(input);
}

export function createCatalogConcert(input: Record<string, unknown>) {
  return createConcert(input);
}

export function createCatalogSeatZone(concertId: string, input: Record<string, unknown>) {
  return createSeatZone(concertId, input);
}

export function createCatalogTicketType(concertId: string, input: Record<string, unknown>) {
  return createTicketType(concertId, input);
}

export async function publishCatalogConcert(concertId: string) {
  await publishConcert(concertId);
}
