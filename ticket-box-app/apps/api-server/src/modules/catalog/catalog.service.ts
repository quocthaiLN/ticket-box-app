import { getCatalogAssetUrl } from "@ticketbox/storage";
import { ApiError } from "../../shared/http/problem-details.js";
import { CatalogRepository } from "./catalog.repository.js";
import type {
  CreateConcertInput,
  CreateSeatZoneInput,
  CreateTicketTypeInput,
  CreateVenueInput,
  ListAdminQuery,
  ListConcertsQuery,
  UpdateConcertInput,
  UpdateSeatZoneInput,
  UpdateTicketTypeInput,
  UpdateVenueInput,
} from "./catalog.schema.js";

export class CatalogService {
  constructor(private readonly repository = new CatalogRepository()) {}

  listPublishedConcerts(query: ListConcertsQuery) {
    return this.repository.listPublishedConcerts(query);
  }

  async getPublishedConcert(concertId: string) {
    const concert = await this.repository.getPublishedConcertById(concertId);

    if (!concert) {
      throw this.notFound("concert", concertId);
    }

    return concert;
  }

  async getMetadata(concertId: string) {
    const metadata = await this.repository.getConcertMetadata(concertId);

    if (!metadata) {
      throw this.notFound("concert", concertId);
    }

    return metadata;
  }

  async getSeatMap(concertId: string) {
    const seatMap = await this.repository.getSeatMap(concertId);

    if (!seatMap) {
      throw this.notFound("concert", concertId);
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

  createVenue(input: CreateVenueInput) {
    return this.repository.createVenue({
      name: input.name,
      address: input.address,
      city: input.city,
      capacity: input.capacity,
      mapUrl: input.map_url,
    });
  }

  updateVenue(venueId: string, input: UpdateVenueInput) {
    return this.repository.updateVenue(venueId, {
      name: input.name,
      address: input.address,
      city: input.city,
      capacity: input.capacity,
      mapUrl: input.map_url,
    });
  }

  async createConcert(input: CreateConcertInput, actorUserId?: string) {
    this.assertTimeRange(input.starts_at, input.ends_at);
    const organizerId = await this.resolveOrganizerId(
      input.organizer_id ?? actorUserId,
    );

    return this.repository.createConcert({
      venueId: input.venue_id,
      organizerId,
      title: input.title,
      slug: input.slug,
      description: input.description,
      artistName: input.artist_name,
      artistBio: input.artist_bio,
      startsAt: new Date(input.starts_at),
      endsAt: new Date(input.ends_at),
      coverImageUrl:
        input.cover_image_url ?? this.assetUrl(input.cover_image_object_key),
      seatMapUrl:
        input.seat_map_url ?? this.assetUrl(input.seat_map_object_key),
    });
  }

  updateConcert(concertId: string, input: UpdateConcertInput) {
    if (input.starts_at && input.ends_at) {
      this.assertTimeRange(input.starts_at, input.ends_at);
    }

    return this.repository.updateConcert(concertId, {
      venueId: input.venue_id,
      title: input.title,
      slug: input.slug,
      description: nullable(input.description),
      artistName: input.artist_name,
      artistBio: nullable(input.artist_bio),
      startsAt: input.starts_at ? new Date(input.starts_at) : undefined,
      endsAt: input.ends_at ? new Date(input.ends_at) : undefined,
      coverImageUrl: nullable(
        input.cover_image_url ?? this.assetUrl(input.cover_image_object_key),
      ),
      seatMapUrl: nullable(
        input.seat_map_url ?? this.assetUrl(input.seat_map_object_key),
      ),
    });
  }

  async publishConcert(concertId: string) {
    const readiness = await this.repository.getPublishReadiness(concertId);

    if (!readiness) {
      throw this.notFound("concert", concertId);
    }

    if (
      !readiness.has_valid_time_range ||
      readiness.seat_zone_count === 0 ||
      readiness.ticket_type_count === 0
    ) {
      throw new ApiError({
        title: "Cannot publish concert",
        status: 422,
        code: "CANNOT_PUBLISH_CONCERT",
        detail:
          "Concert must have a valid time range, at least one seat zone, and at least one ticket type.",
      });
    }

    return this.repository.setConcertStatus(concertId, "PUBLISHED");
  }

  cancelConcert(concertId: string) {
    return this.repository.setConcertStatus(concertId, "CANCELLED");
  }

  createSeatZone(concertId: string, input: CreateSeatZoneInput) {
    return this.repository.createSeatZone(concertId, {
      code: input.code,
      name: input.name,
      description: input.description,
      capacity: input.capacity,
      svgPath: input.svg_path,
      sortOrder: input.sort_order,
    });
  }

  updateSeatZone(seatZoneId: string, input: UpdateSeatZoneInput) {
    return this.repository.updateSeatZone(seatZoneId, {
      code: input.code,
      name: input.name,
      description: nullable(input.description),
      capacity: input.capacity,
      svgPath: nullable(input.svg_path),
      sortOrder: input.sort_order,
    });
  }

  async createTicketType(concertId: string, input: CreateTicketTypeInput) {
    this.assertSaleWindow(input.sale_start_at, input.sale_end_at);
    const usage = await this.repository.getSeatZoneCapacityUsage(
      input.seat_zone_id,
    );

    if (!usage || usage.concert_id !== concertId) {
      throw this.notFound("seat_zone", input.seat_zone_id);
    }

    if (usage.configured_quantity + input.total_quantity > usage.capacity) {
      throw this.capacityExceeded();
    }

    return this.repository.createTicketType(concertId, {
      seatZoneId: input.seat_zone_id,
      name: input.name,
      description: input.description,
      price: input.price.amount,
      totalQuantity: input.total_quantity,
      maxPerUser: input.max_per_user,
      saleStartAt: new Date(input.sale_start_at),
      saleEndAt: new Date(input.sale_end_at),
    });
  }

  async updateTicketType(ticketTypeId: string, input: UpdateTicketTypeInput) {
    if (input.sale_start_at && input.sale_end_at) {
      this.assertSaleWindow(input.sale_start_at, input.sale_end_at);
    }

    return this.repository.updateTicketType(ticketTypeId, {
      seatZoneId: input.seat_zone_id,
      name: input.name,
      description: nullable(input.description),
      price: input.price?.amount,
      totalQuantity: input.total_quantity,
      maxPerUser: input.max_per_user,
      saleStartAt: input.sale_start_at
        ? new Date(input.sale_start_at)
        : undefined,
      saleEndAt: input.sale_end_at ? new Date(input.sale_end_at) : undefined,
      status: input.status,
    });
  }

  private async resolveOrganizerId(candidate?: string) {
    if (candidate && isUuid(candidate)) {
      return candidate;
    }

    const fallback = await this.repository.findDefaultOrganizerId();
    if (!fallback) {
      throw new ApiError({
        title: "Organizer not found",
        status: 422,
        code: "ORGANIZER_NOT_FOUND",
        detail: "A valid organizer user is required to create a concert.",
      });
    }

    return fallback;
  }

  private assertTimeRange(startsAt: string, endsAt: string) {
    if (new Date(endsAt) <= new Date(startsAt)) {
      throw new ApiError({
        title: "Invalid concert time range",
        status: 422,
        code: "INVALID_CONCERT_TIME_RANGE",
        detail: "ends_at must be later than starts_at.",
      });
    }
  }

  private assertSaleWindow(startsAt: string, endsAt: string) {
    if (new Date(endsAt) <= new Date(startsAt)) {
      throw new ApiError({
        title: "Invalid sale window",
        status: 422,
        code: "INVALID_SALE_WINDOW",
        detail: "sale_end_at must be later than sale_start_at.",
      });
    }
  }

  private assetUrl(objectKey?: string) {
    return objectKey ? getCatalogAssetUrl(objectKey) : undefined;
  }

  private notFound(resource: "concert" | "seat_zone", id: string) {
    const code =
      resource === "concert" ? "CONCERT_NOT_FOUND" : "SEAT_ZONE_NOT_FOUND";
    return new ApiError({
      title:
        resource === "concert" ? "Concert not found" : "Seat zone not found",
      status: 404,
      code,
      detail: `${resource} ${id} does not exist or is not accessible.`,
    });
  }

  private capacityExceeded() {
    return new ApiError({
      title: "Zone capacity exceeded",
      status: 422,
      code: "ZONE_CAPACITY_EXCEEDED",
      detail: "Configured ticket quantity would exceed the seat zone capacity.",
    });
  }
}

function nullable(value: string | undefined): string | null | undefined {
  return value === undefined ? undefined : value;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
