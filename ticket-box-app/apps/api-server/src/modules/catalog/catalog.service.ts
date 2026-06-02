import { ApiError } from "../../shared/http/problem-details.js";
import { CatalogRepository } from "./catalog.repository.js";
import type { ListAdminQuery, ListConcertsQuery } from "./catalog.schema.js";

export class CatalogService {
  constructor(private readonly repository = new CatalogRepository()) {}

  listPublishedConcerts(query: ListConcertsQuery) {
    return this.repository.listPublishedConcerts(query);
  }

  async getPublishedConcert(concertId: string) {
    const concert = await this.repository.getPublishedConcertById(concertId);

    if (!concert) {
      throw this.notFound(concertId);
    }

    return concert;
  }

  async getMetadata(concertId: string) {
    const metadata = await this.repository.getConcertMetadata(concertId);

    if (!metadata) {
      throw this.notFound(concertId);
    }

    return metadata;
  }

  async getSeatMap(concertId: string) {
    const seatMap = await this.repository.getSeatMap(concertId);

    if (!seatMap) {
      throw this.notFound(concertId);
    }

    return seatMap;
  }

  listTicketTypes(concertId: string, includeClosed: boolean) {
    return this.repository.listTicketTypes(concertId, includeClosed);
  }

  getInventory(concertId: string) {
    return this.repository.getInventorySnapshot(concertId);
  }

  listVenues(query: ListConcertsQuery) {
    return this.repository.listVenues(query);
  }

  listAdminConcerts(query: ListAdminQuery) {
    return this.repository.listAdminConcerts(query);
  }

  notImplemented(resource: string) {
    throw new ApiError({
      type: "https://api.ticketbox.vn/errors/not-implemented",
      title: "Not implemented",
      status: 501,
      code: "NOT_IMPLEMENTED",
      detail: `${resource} is scaffolded for Sprint 1 and will be implemented in a later sprint.`
    });
  }

  private notFound(concertId: string) {
    return new ApiError({
      type: "https://api.ticketbox.vn/errors/concert-not-found",
      title: "Concert not found",
      status: 404,
      code: "CONCERT_NOT_FOUND",
      detail: `Concert ${concertId} does not exist or is not published.`
    });
  }
}
