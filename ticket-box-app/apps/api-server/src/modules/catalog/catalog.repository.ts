import {
  ConcertStatus,
  Prisma,
  TicketTypeStatus,
  UserStatus,
  prisma
} from "@ticketbox/database";
import type { ListAdminQuery, ListConcertsQuery } from "./catalog.schema.js";
import type {
  ConcertDetailDto,
  ConcertMetadataDto,
  ConcertSummaryDto,
  InventoryDto,
  SeatMapDto,
  SeatZoneDto,
  TicketTypeDto,
  VenueDto
} from "./catalog.types.js";

type ConcertWithVenueAndPrices = Prisma.ConcertGetPayload<{
  include: {
    venue: true;
    ticketTypes: { select: { price: true; currency: true } };
  };
}>;

type ConcertDetailRecord = Prisma.ConcertGetPayload<{
  include: { venue: true };
}>;

type ConcertMetadataRecord = Prisma.ConcertGetPayload<{
  include: {
    venue: true;
    seatZones: { orderBy: { sortOrder: "asc" } };
    ticketTypes: { include: { seatZone: true }; orderBy: { price: "asc" } };
  };
}>;

type TicketTypeWithZone = Prisma.TicketTypeGetPayload<{
  include: { seatZone: true };
}>;

export class CatalogRepository {
  async listPublishedConcerts(query: ListConcertsQuery): Promise<ConcertSummaryDto[]> {
    const concerts = await prisma.concert.findMany({
      where: {
        ...buildConcertFilters(query),
        status: ConcertStatus.PUBLISHED
      },
      include: {
        venue: true,
        ticketTypes: {
          select: { price: true, currency: true }
        }
      },
      orderBy: buildOrderBy(query.sort),
      take: query.limit
    });

    return concerts.map(mapConcertSummary);
  }

  async getPublishedConcertById(concertId: string): Promise<ConcertDetailDto | null> {
    const concert = await prisma.concert.findFirst({
      where: {
        ...buildConcertIdentityFilter(concertId),
        status: ConcertStatus.PUBLISHED
      },
      include: { venue: true }
    });

    return concert ? mapConcertDetail(concert) : null;
  }

  async getConcertMetadata(concertId: string): Promise<ConcertMetadataDto | null> {
    const concert = await prisma.concert.findFirst({
      where: {
        ...buildConcertIdentityFilter(concertId),
        status: ConcertStatus.PUBLISHED
      },
      include: {
        venue: true,
        seatZones: { orderBy: { sortOrder: "asc" } },
        ticketTypes: {
          include: { seatZone: true },
          orderBy: { price: "asc" }
        }
      }
    });

    return concert ? mapConcertMetadata(concert) : null;
  }

  // Admin preview: không lọc status để xem được cả concert DRAFT.
  async getConcertMetadataAnyStatus(concertId: string): Promise<ConcertMetadataDto | null> {
    const concert = await prisma.concert.findFirst({
      where: buildConcertIdentityFilter(concertId),
      include: {
        venue: true,
        seatZones: { orderBy: { sortOrder: "asc" } },
        ticketTypes: {
          include: { seatZone: true },
          orderBy: { price: "asc" }
        }
      }
    });

    return concert ? mapConcertMetadata(concert) : null;
  }

  async getSeatMap(concertId: string): Promise<SeatMapDto | null> {
    const concert = await prisma.concert.findFirst({
      where: {
        ...buildConcertIdentityFilter(concertId),
        status: ConcertStatus.PUBLISHED
      },
      include: {
        seatZones: { orderBy: { sortOrder: "asc" } }
      }
    });

    if (!concert) return null;

    return {
      concert_id: concert.id,
      svg_url: concert.seatMapUrl ?? undefined,
      zones: concert.seatZones.map((zone) => ({
        seat_zone_id: zone.id,
        code: zone.code,
        name: zone.name,
        svg_path: zone.svgPath ?? undefined,
        sort_order: zone.sortOrder
      }))
    };
  }

  async listTicketTypes(concertId: string, includeClosed: boolean): Promise<TicketTypeDto[]> {
    const concert = await prisma.concert.findFirst({
      where: {
        ...buildConcertIdentityFilter(concertId),
        status: ConcertStatus.PUBLISHED
      },
      select: { id: true }
    });

    if (!concert) return [];

    const statuses = includeClosed
      ? [TicketTypeStatus.ON_SALE, TicketTypeStatus.SOLD_OUT, TicketTypeStatus.CLOSED]
      : [TicketTypeStatus.ON_SALE, TicketTypeStatus.SOLD_OUT];

    const ticketTypes = await prisma.ticketType.findMany({
      where: {
        concertId: concert.id,
        status: { in: statuses }
      },
      include: { seatZone: true },
      orderBy: [{ price: "asc" }, { name: "asc" }]
    });

    return ticketTypes.map(mapTicketType);
  }

  async getInventorySnapshot(concertId: string): Promise<InventoryDto> {
    const concert = await prisma.concert.findFirst({
      where: {
        ...buildConcertIdentityFilter(concertId),
        status: ConcertStatus.PUBLISHED
      },
      select: { id: true }
    });

    if (!concert) {
      return { concert_id: concertId, as_of: new Date().toISOString(), items: [] };
    }

    const ticketTypes = await prisma.ticketType.findMany({
      where: {
        concertId: concert.id,
        status: { in: [TicketTypeStatus.ON_SALE, TicketTypeStatus.SOLD_OUT, TicketTypeStatus.CLOSED] }
      },
      include: { seatZone: true },
      orderBy: [{ price: "asc" }, { name: "asc" }]
    });

    return {
      concert_id: concert.id,
      as_of: new Date().toISOString(),
      items: ticketTypes.map((ticketType) => {
        const available = Math.max(
          ticketType.totalQuantity - ticketType.heldQuantity - ticketType.soldQuantity,
          0
        );
        const status =
          ticketType.status === TicketTypeStatus.DRAFT ? TicketTypeStatus.CLOSED : ticketType.status;

        return {
          ticket_type_id: ticketType.id,
          seat_zone_id: ticketType.seatZoneId,
          zone_code: ticketType.seatZone.code,
          available_quantity: available,
          status: status as "ON_SALE" | "SOLD_OUT" | "CLOSED",
          display_status: getDisplayStatus(status, available)
        };
      })
    };
  }

  async listVenues(query: ListConcertsQuery): Promise<VenueDto[]> {
    const venues = await prisma.venue.findMany({
      where: buildVenueFilters(query),
      orderBy: { name: "asc" },
      take: query.limit
    });

    return venues.map(mapVenue);
  }

  async listAdminConcerts(
    query: ListAdminQuery
  ): Promise<(ConcertSummaryDto & { guest_drive_folder_id?: string })[]> {
    const concerts = await prisma.concert.findMany({
      where: {
        ...buildConcertFilters(query),
        ...(query.status ? { status: query.status } : {}),
        ...(query.venue_id ? { venueId: query.venue_id } : {})
      },
      include: {
        venue: true,
        ticketTypes: {
          select: { price: true, currency: true }
        }
      },
      orderBy: buildOrderBy(query.sort),
      take: query.limit
    });

    // Admin-only: kèm thư mục Drive khách mời để UI hiển thị link đã gán.
    return concerts.map((concert) => ({
      ...mapConcertSummary(concert),
      guest_drive_folder_id: concert.guestDriveFolderId ?? undefined
    }));
  }

  async createVenue(input: {
    name: string;
    address: string;
    city: string;
    capacity?: number;
    mapUrl?: string;
  }): Promise<VenueDto> {
    return mapVenue(await prisma.venue.create({ data: input }));
  }

  async updateVenue(
    venueId: string,
    input: Partial<{ name: string; address: string; city: string; capacity: number; mapUrl: string | null }>
  ): Promise<VenueDto> {
    return mapVenue(await prisma.venue.update({ where: { id: venueId }, data: input }));
  }

  async createConcert(input: {
    id?: string;
    venueId: string;
    organizerId: string;
    title: string;
    slug: string;
    description?: string;
    artistName: string;
    artistBio?: string;
    startsAt: Date;
    endsAt: Date;
    coverImageUrl?: string;
    seatMapUrl?: string;
    guestDriveFolderId?: string;
  }): Promise<ConcertDetailDto> {
    const concert = await prisma.concert.create({
      data: input,
      include: { venue: true }
    });

    return mapConcertDetail(concert);
  }

  async updateConcert(
    concertId: string,
    input: Partial<{
      venueId: string;
      title: string;
      slug: string;
      description: string | null;
      artistName: string;
      artistBio: string | null;
      startsAt: Date;
      endsAt: Date;
      coverImageUrl: string | null;
      seatMapUrl: string | null;
      guestDriveFolderId: string | null;
    }>
  ): Promise<ConcertDetailDto> {
    const concert = await prisma.concert.update({
      where: { id: concertId },
      data: input,
      include: { venue: true }
    });

    return mapConcertDetail(concert);
  }

  async setConcertStatus(concertId: string, status: "PUBLISHED" | "CANCELLED" | "COMPLETED"): Promise<ConcertDetailDto> {
    const concert = await prisma.$transaction(async (tx) => {
      const updatedConcert = await tx.concert.update({
        where: { id: concertId },
        data: { status },
        include: { venue: true }
      });

      if (status === ConcertStatus.CANCELLED || status === ConcertStatus.COMPLETED) {
        await tx.user.updateMany({
          where: {
            role: "CHECKER",
            status: { not: UserStatus.DISABLED },
            concertCheckerAccounts: { some: { concertId } }
          },
          data: { status: UserStatus.DISABLED }
        });
      }

      return updatedConcert;
    });

    return mapConcertDetail(concert);
  }

  async getPublishReadiness(concertId: string) {
    const concert = await prisma.concert.findUnique({
      where: { id: concertId },
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        _count: {
          select: {
            seatZones: true,
            ticketTypes: true
          }
        }
      }
    });

    if (!concert) return null;

    return {
      has_valid_time_range: concert.endsAt > concert.startsAt,
      seat_zone_count: concert._count.seatZones,
      ticket_type_count: concert._count.ticketTypes
    };
  }

  async createSeatZone(concertId: string, input: {
    code: string;
    name: string;
    description?: string;
    capacity: number;
    svgPath?: string;
    sortOrder: number;
  }): Promise<SeatZoneDto> {
    return mapSeatZone(await prisma.seatZone.create({ data: { ...input, concertId } }));
  }

  async updateSeatZone(
    seatZoneId: string,
    input: Partial<{ code: string; name: string; description: string | null; capacity: number; svgPath: string | null; sortOrder: number }>
  ): Promise<SeatZoneDto> {
    return mapSeatZone(await prisma.seatZone.update({ where: { id: seatZoneId }, data: input }));
  }

  async getSeatZoneCapacityUsage(seatZoneId: string) {
    const zone = await prisma.seatZone.findUnique({
      where: { id: seatZoneId },
      include: { ticketTypes: { select: { id: true, totalQuantity: true } } }
    });

    if (!zone) return null;

    return {
      concert_id: zone.concertId,
      capacity: zone.capacity,
      configured_quantity: zone.ticketTypes.reduce((total, item) => total + item.totalQuantity, 0)
    };
  }

  async createTicketType(concertId: string, input: {
    seatZoneId: string;
    name: string;
    description?: string;
    price: number;
    totalQuantity: number;
    maxPerUser: number;
    saleStartAt: Date;
    saleEndAt: Date;
  }): Promise<TicketTypeDto> {
    const ticketType = await prisma.ticketType.create({
      data: {
        ...input,
        concertId,
        currency: "VND",
        status: TicketTypeStatus.DRAFT
      },
      include: { seatZone: true }
    });

    return mapTicketType(ticketType);
  }

  async updateTicketType(
    ticketTypeId: string,
    input: Partial<{
      seatZoneId: string;
      name: string;
      description: string | null;
      price: number;
      totalQuantity: number;
      maxPerUser: number;
      saleStartAt: Date;
      saleEndAt: Date;
      status: "DRAFT" | "ON_SALE" | "SOLD_OUT" | "CLOSED";
    }>
  ): Promise<TicketTypeDto> {
    const ticketType = await prisma.ticketType.update({
      where: { id: ticketTypeId },
      data: input,
      include: { seatZone: true }
    });

    return mapTicketType(ticketType);
  }

  async findDefaultOrganizerId(): Promise<string | null> {
    const user = await prisma.user.findFirst({
      where: { role: { in: ["ORGANIZER", "ADMIN"] }, status: "ACTIVE" },
      orderBy: { createdAt: "asc" },
      select: { id: true }
    });

    return user?.id ?? null;
  }
}

function buildConcertFilters(query: ListConcertsQuery): Prisma.ConcertWhereInput {
  return {
    ...(query.q
      ? {
          OR: [
            { title: { contains: query.q, mode: "insensitive" } },
            { artistName: { contains: query.q, mode: "insensitive" } }
          ]
        }
      : {}),
    ...(query.city ? { venue: { city: { contains: query.city, mode: "insensitive" } } } : {}),
    ...(query.from || query.to
      ? {
          startsAt: {
            ...(query.from ? { gte: new Date(query.from) } : {}),
            ...(query.to ? { lte: new Date(query.to) } : {})
          }
        }
      : {})
  };
}

function buildVenueFilters(query: ListConcertsQuery): Prisma.VenueWhereInput {
  return {
    ...(query.q
      ? {
          OR: [
            { name: { contains: query.q, mode: "insensitive" } },
            { address: { contains: query.q, mode: "insensitive" } }
          ]
        }
      : {}),
    ...(query.city ? { city: { contains: query.city, mode: "insensitive" } } : {})
  };
}

function buildConcertIdentityFilter(value: string): Prisma.ConcertWhereInput {
  return isUuid(value) ? { id: value } : { slug: value };
}

function buildOrderBy(sort: ListConcertsQuery["sort"]): Prisma.ConcertOrderByWithRelationInput {
  if (sort === "-starts_at") return { startsAt: "desc" };
  if (sort === "title") return { title: "asc" };
  return { startsAt: "asc" };
}

function mapConcertSummary(concert: ConcertWithVenueAndPrices): ConcertSummaryDto {
  const prices = concert.ticketTypes.map((ticketType) => Number(ticketType.price));

  return {
    id: concert.id,
    title: concert.title,
    slug: concert.slug,
    description: concert.description ?? undefined,
    artist_name: concert.artistName,
    starts_at: concert.startsAt.toISOString(),
    ends_at: concert.endsAt.toISOString(),
    status: concert.status,
    cover_image_url: concert.coverImageUrl ?? undefined,
    venue: {
      id: concert.venue.id,
      name: concert.venue.name,
      city: concert.venue.city
    },
    ticket_price_range:
      prices.length > 0
        ? {
            min_amount: Math.min(...prices),
            max_amount: Math.max(...prices),
            currency: "VND"
          }
        : undefined
  };
}

function mapConcertDetail(concert: ConcertDetailRecord): ConcertDetailDto {
  return {
    id: concert.id,
    title: concert.title,
    slug: concert.slug,
    description: concert.description ?? undefined,
    artist_name: concert.artistName,
    artist_bio: concert.artistBio ?? undefined,
    artist_bio_image_url: concert.artistBioImageUrl ?? undefined,
    starts_at: concert.startsAt.toISOString(),
    ends_at: concert.endsAt.toISOString(),
    status: concert.status,
    cover_image_url: concert.coverImageUrl ?? undefined,
    seat_map_url: concert.seatMapUrl ?? undefined,
    venue: mapVenue(concert.venue)
  };
}

function mapConcertMetadata(concert: ConcertMetadataRecord): ConcertMetadataDto {
  const detail = mapConcertDetail(concert);

  return {
    concert: {
      id: detail.id,
      title: detail.title,
      slug: detail.slug,
      description: detail.description,
      artist_name: detail.artist_name,
      starts_at: detail.starts_at,
      ends_at: detail.ends_at,
      status: detail.status,
      cover_image_url: detail.cover_image_url
    },
    venue: mapVenue(concert.venue),
    seat_zones: concert.seatZones.map(mapSeatZone),
    ticket_types: concert.ticketTypes.map(mapTicketType),
    seat_map: {
      svg_url: concert.seatMapUrl ?? undefined
    },
    artist_bio: concert.artistBio ?? undefined,
    artist_bio_image_url: concert.artistBioImageUrl ?? undefined
  };
}

function mapVenue(venue: Prisma.VenueGetPayload<Record<string, never>>): VenueDto {
  return {
    id: venue.id,
    name: venue.name,
    address: venue.address,
    city: venue.city,
    capacity: venue.capacity ?? undefined,
    map_url: venue.mapUrl ?? undefined
  };
}

function mapSeatZone(zone: Prisma.SeatZoneGetPayload<Record<string, never>>): SeatZoneDto {
  return {
    id: zone.id,
    code: zone.code,
    name: zone.name,
    description: zone.description ?? undefined,
    capacity: zone.capacity,
    svg_path: zone.svgPath ?? undefined,
    sort_order: zone.sortOrder
  };
}

function mapTicketType(ticketType: TicketTypeWithZone): TicketTypeDto {
  return {
    id: ticketType.id,
    concert_id: ticketType.concertId,
    seat_zone_id: ticketType.seatZoneId,
    zone_code: ticketType.seatZone.code,
    name: ticketType.name,
    description: ticketType.description ?? undefined,
    price: {
      amount: Number(ticketType.price),
      currency: "VND"
    },
    max_per_user: ticketType.maxPerUser,
    sale_start_at: ticketType.saleStartAt.toISOString(),
    sale_end_at: ticketType.saleEndAt.toISOString(),
    status: ticketType.status
  };
}

function getDisplayStatus(status: TicketTypeStatus, available: number): InventoryDto["items"][number]["display_status"] {
  if (status === TicketTypeStatus.CLOSED) return "CLOSED";
  if (status === TicketTypeStatus.SOLD_OUT || available === 0) return "SOLD_OUT";
  if (available <= 20) return "LOW_STOCK";
  return "AVAILABLE";
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
