import type { ListAdminQuery, ListConcertsQuery } from "./catalog.schema.js";
import type {
  ConcertDetailDto,
  ConcertMetadataDto,
  ConcertSummaryDto,
  InventoryDto,
  SeatMapDto,
  TicketTypeDto,
  VenueDto
} from "./catalog.types.js";

export class CatalogRepository {
  async listPublishedConcerts(_query: ListConcertsQuery): Promise<ConcertSummaryDto[]> {
    return [];
  }

  async getPublishedConcertById(_concertId: string): Promise<ConcertDetailDto | null> {
    return null;
  }

  async getConcertMetadata(_concertId: string): Promise<ConcertMetadataDto | null> {
    return null;
  }

  async getSeatMap(_concertId: string): Promise<SeatMapDto | null> {
    return null;
  }

  async listTicketTypes(_concertId: string, _includeClosed: boolean): Promise<TicketTypeDto[]> {
    return [];
  }

  async getInventorySnapshot(concertId: string): Promise<InventoryDto> {
    return {
      concert_id: concertId,
      as_of: new Date().toISOString(),
      items: []
    };
  }

  async listVenues(_query: ListConcertsQuery): Promise<VenueDto[]> {
    return [];
  }

  async listAdminConcerts(_query: ListAdminQuery): Promise<ConcertSummaryDto[]> {
    return [];
  }
}
