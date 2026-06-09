import {
  getConcert,
  getConcertMetadata,
  getInventory,
  listConcerts,
} from "../lib/api-client";
import {
  mapDetailConcert,
  mapSummaryConcert,
  type UiConcert,
} from "../lib/catalog-ui";

export type LoadEventsInput = {
  search?: string;
  city?: string;
};

export async function getHomeCatalogConcerts(): Promise<UiConcert[]> {
  const concerts = await listConcerts({ sort: "starts_at" });
  return concerts.map(mapSummaryConcert);
}

export async function getEventsCatalog(input: LoadEventsInput = {}): Promise<UiConcert[]> {
  const concerts = await listConcerts({
    q: input.search ?? "",
    city: input.city === "all" ? "" : input.city ?? "",
    sort: "starts_at",
  });

  return concerts.map(mapSummaryConcert);
}

export async function getCatalogConcertDetail(concertId: string): Promise<UiConcert> {
  const [concert, metadata, inventory] = await Promise.all([
    getConcert(concertId),
    getConcertMetadata(concertId),
    getInventory(concertId),
  ]);

  return mapDetailConcert(concert, metadata, inventory);
}

export function getCityFilters(concerts: UiConcert[], allLabel = "All") {
  return [allLabel, ...Array.from(new Set(concerts.map((concert) => concert.venue.city))).sort()];
}

export function filterHomeConcerts(
  concerts: UiConcert[],
  input: { searchQuery: string; activeFilter: string; allLabel?: string },
) {
  const allLabel = input.allLabel ?? "All";
  const query = input.searchQuery.trim().toLowerCase();

  return concerts.filter((concert) => {
    const matchesSearch =
      !query ||
      concert.title.toLowerCase().includes(query) ||
      concert.artistName.toLowerCase().includes(query) ||
      concert.venue.city.toLowerCase().includes(query);
    const matchesFilter = input.activeFilter === allLabel || concert.venue.city === input.activeFilter;

    return matchesSearch && matchesFilter;
  });
}
