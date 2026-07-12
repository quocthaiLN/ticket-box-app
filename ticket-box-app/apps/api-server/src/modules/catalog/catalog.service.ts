import { randomUUID } from "crypto";
import { createHash } from "crypto";
import { getCatalogAssetUrl } from "@ticketbox/storage";
import {
  cacheSingleFlight,
  catalogCacheKeys,
  catalogCacheTtlSeconds,
} from "@ticketbox/redis";
import { Errors } from "../../shared/http/problem-details.js";
import { buildConcertSlug } from "../../shared/utils/slug.js";
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
    const key = catalogCacheKeys.list(hashQuery(query));
    return cacheSingleFlight(
      key,
      () => this.repository.listPublishedConcerts(query),
      catalogCacheTtlSeconds.list,
    );
  }

  async getPublishedConcert(concertId: string) {
    const concert = await cacheSingleFlight(
      catalogCacheKeys.concert(concertId),
      () => this.repository.getPublishedConcertById(concertId),
      catalogCacheTtlSeconds.concert,
    );

    if (!concert) {
      throw this.notFound("concert", concertId);
    }

    return concert;
  }

  async getMetadata(concertId: string) {
    const metadata = await cacheSingleFlight(
      catalogCacheKeys.metadata(concertId),
      () => this.repository.getConcertMetadata(concertId),
      // Dùng 3600s thay vì 86400s để an toàn hơn với invalidation hiện tại
      3600,
    );

    if (!metadata) {
      throw this.notFound("concert", concertId);
    }

    return metadata;
  }

  async getAdminMetadata(concertId: string) {
    const metadata = await this.repository.getConcertMetadataAnyStatus(concertId);

    if (!metadata) {
      throw this.notFound("concert", concertId);
    }

    return metadata;
  }

  async getSeatMap(concertId: string) {
    const seatMap = await cacheSingleFlight(
      catalogCacheKeys.seatMap(concertId),
      () => this.repository.getSeatMap(concertId),
      catalogCacheTtlSeconds.seatMap,
    );

    if (!seatMap) {
      throw this.notFound("concert", concertId);
    }

    return seatMap;
  }

  listTicketTypes(concertId: string, includeClosed: boolean) {
    return cacheSingleFlight(
      catalogCacheKeys.ticketTypes(concertId, includeClosed),
      () => this.repository.listTicketTypes(concertId, includeClosed),
      catalogCacheTtlSeconds.ticketTypes,
    );
  }

  getInventory(concertId: string) {
    return cacheSingleFlight(
      catalogCacheKeys.inventory(concertId),
      () => this.repository.getInventorySnapshot(concertId),
      catalogCacheTtlSeconds.inventory,
    );
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

    const concertId = randomUUID();

    return this.repository.createConcert({
      id: concertId,
      venueId: input.venue_id,
      organizerId,
      title: input.title,
      slug: buildConcertSlug(input.slug ?? input.title, concertId),
      description: input.description,
      artistName: input.artist_name,
      artistBio: input.artist_bio,
      startsAt: new Date(input.starts_at),
      endsAt: new Date(input.ends_at),
      coverImageUrl:
        input.cover_image_url ?? this.assetUrl(input.cover_image_object_key),
      seatMapUrl:
        input.seat_map_url ?? this.assetUrl(input.seat_map_object_key),
      seatMapImageUrl: input.seat_map_image_url,
      guestDriveFolderId: input.guest_drive_folder_id,
    });
  }

  updateConcert(concertId: string, input: UpdateConcertInput) {
    if (input.starts_at && input.ends_at) {
      this.assertTimeRange(input.starts_at, input.ends_at);
    }

    // Đổi tên/slug chỉ xảy ra khi DRAFT nên không cần redirect URL cũ;
    // suffix theo concert id giữ slug luôn unique.
    const slugSource = input.slug ?? input.title;

    return this.repository.updateConcert(concertId, {
      venueId: input.venue_id,
      title: input.title,
      slug: slugSource ? buildConcertSlug(slugSource, concertId) : undefined,
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
      seatMapImageUrl: nullable(input.seat_map_image_url),
      guestDriveFolderId: nullable(input.guest_drive_folder_id),
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
      throw Errors.cannotPublishConcert();
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
      throw Errors.organizerNotFound();
    }

    return fallback;
  }

  private assertTimeRange(startsAt: string, endsAt: string) {
    if (new Date(endsAt) <= new Date(startsAt)) {
      throw Errors.invalidConcertTimeRange();
    }
  }

  private assertSaleWindow(startsAt: string, endsAt: string) {
    if (new Date(endsAt) <= new Date(startsAt)) {
      throw Errors.invalidSaleWindow();
    }
  }

  private assetUrl(objectKey?: string) {
    return objectKey ? getCatalogAssetUrl(objectKey) : undefined;
  }

  private notFound(resource: "concert" | "seat_zone", id: string) {
    return resource === "concert"
      ? Errors.concertNotFound(id)
      : Errors.seatZoneNotFound(id);
  }

  private capacityExceeded() {
    return Errors.zoneCapacityExceeded();
  }
}

function nullable(value: string | undefined): string | null | undefined {
  return value === undefined ? undefined : value;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/**
 * Serialize query object theo thứ tự key cố định rồi hash MD5 để tạo cache key ổn định.
 * Tránh hai request cùng params nhưng khác thứ tự tạo ra hai cache key khác nhau.
 */
function hashQuery(query: Record<string, unknown>): string {
  // Thứ tự key cố định: q, city, from, to, limit, cursor, sort
  const ORDERED_KEYS = ["q", "city", "from", "to", "limit", "cursor", "sort"] as const;
  const normalized: Record<string, unknown> = {};
  for (const k of ORDERED_KEYS) {
    if (query[k] !== undefined && query[k] !== null && query[k] !== "") {
      normalized[k] = query[k];
    }
  }
  // Thêm bất kỳ key nào không nằm trong danh sách trên (theo thứ tự alphabet)
  for (const k of Object.keys(query).sort()) {
    if (!(ORDERED_KEYS as readonly string[]).includes(k) && query[k] !== undefined) {
      normalized[k] = query[k];
    }
  }
  return createHash("sha256")
    .update(JSON.stringify(normalized))
    .digest("hex")
    .slice(0, 16);
}
