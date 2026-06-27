import {
  ApprovalStatus,
  ConcertStatus,
  GuestStatus,
  OrderStatus,
  Prisma,
  TicketTypeStatus,
  prisma,
} from "@ticketbox/database";
import { enqueueAiBio } from "@ticketbox/queue";
import type {
  CreateOrganizerSeatZoneInput,
  CreateOrganizerTicketTypeInput,
  CreateOrganizerRequestInput,
  ListQuery,
  UpdateOrganizerConcertInput,
} from "./organizer.schema.js";

export type Page<T> = {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
  limit: number;
};

export type OrganizerVenueDto = {
  id: string;
  name: string;
  address: string;
  city: string;
  capacity?: number;
  map_url?: string;
};

export type OrganizerRequestSummaryDto = {
  id: string;
  title: string;
  artist_name: string;
  venue_id: string;
  starts_at: string;
  ends_at: string;
  planned_publish_at?: string;
  gate_count: number;
  checker_count: number;
  status: string;
  concert_id?: string | null;
  created_at: string;
};

export type OrganizerRequestDetailDto = OrganizerRequestSummaryDto & {
  description?: string;
  press_kit_url?: string;
  artist_bio?: string | null;
  bio_status?: string | null;
  artist_bio_image_url?: string | null;
  ticket_types: unknown;
  reviewed_by?: string | null;
  reviewed_at?: string;
  review_note?: string;
  updated_at: string;
};

export type OrganizerConcertSummaryDto = {
  id: string;
  title: string;
  slug: string;
  description?: string;
  artist_name: string;
  artist_bio?: string;
  status: string;
  starts_at: string;
  ends_at: string;
  planned_publish_at?: string;
  cover_image_url?: string;
  venue: {
    id: string;
    name: string;
    city: string;
  };
  seat_zones: OrganizerSeatZoneDto[];
  ticket_types: OrganizerTicketTypeDto[];
};

export type OrganizerSeatZoneDto = {
  id: string;
  code: string;
  name: string;
  description?: string;
  capacity: number;
  svg_path?: string;
  sort_order: number;
};

export type OrganizerTicketTypeDto = {
  id: string;
  seat_zone_id: string;
  name: string;
  description?: string;
  zone_code: string;
  zone_name: string;
  price: {
    amount: number;
    currency: "VND";
  };
  total_quantity: number;
  held_quantity: number;
  sold_quantity: number;
  available_quantity: number;
  max_per_user: number;
  sale_start_at: string;
  sale_end_at: string;
  status: string;
};

export type OrganizerConcertUpdateDto = {
  id: string;
  status: string;
  updated_at: string;
};

export type DeletionRequestDto = {
  id: string;
  concert_id: string;
  status: string;
  created_at: string;
};

export type AnalyticsDto = {
  concert_id: string;
  revenue: {
    amount: number;
    currency: "VND";
  };
  tickets_sold: number;
  tickets_total: number;
  checked_in: number;
  check_in_rate: number;
};

export type OrganizerOrderDto = {
  id: string;
  concert_id: string;
  concert_title: string;
  status: string;
  total_amount: {
    amount: number;
    currency: string;
  };
  created_at: string;
  confirmed_at?: string;
};

export type OrganizerInventoryDto = {
  ticket_type_id: string;
  concert_id: string;
  total: number;
  held: number;
  sold: number;
  available: number;
};

export type CheckerAccountDto = {
  id: string;
  concert_id: string;
  concert_title: string;
  user_id: string;
  email: string;
  full_name: string;
  status: string;
  created_at: string;
};

export type OrganizerGuestDto = {
  id: string;
  concert_id: string;
  seat_zone_id?: string | null;
  full_name: string;
  phone: string | null;
  email: string;
  code?: string | null;
  status: string;
  checked_in_at?: string;
  created_at: string;
};

type UpdateConcertData = Partial<{
  venueId: string;
  title: string;
  description: string | null;
  artistName: string;
  artistBio: string | null;
  startsAt: Date;
  endsAt: Date;
  plannedPublishAt: Date | null;
  coverImageUrl: string | null;
  seatMapUrl: string | null;
  artistBioImageUrl: string | null;
}>;

export class OrganizerRepository {
  async listVenues(query: ListQuery): Promise<Page<OrganizerVenueDto>> {
    const venues = await prisma.venue.findMany({
      where: {
        ...(query.q
          ? {
              OR: [
                { name: { contains: query.q, mode: "insensitive" } },
                { address: { contains: query.q, mode: "insensitive" } },
              ],
            }
          : {}),
        ...(query.city
          ? { city: { contains: query.city, mode: "insensitive" } }
          : {}),
      },
      orderBy: { name: "asc" },
      take: query.limit + 1,
    });

    return page(venues.map(mapVenue), query.limit);
  }

  async venueExists(venueId: string) {
    const venue = await prisma.venue.findUnique({
      where: { id: venueId },
      select: { id: true },
    });

    return Boolean(venue);
  }

  async listRequests(
    organizerId: string,
    query: ListQuery,
  ): Promise<Page<OrganizerRequestSummaryDto>> {
    const requests = await prisma.organizerRequest.findMany({
      where: {
        organizerId,
        ...(query.status ? { status: query.status as ApprovalStatus } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: query.limit + 1,
    });

    return page(requests.map(mapRequestSummary), query.limit);
  }

  async createRequest(
    organizerId: string,
    input: CreateOrganizerRequestInput,
  ): Promise<OrganizerRequestSummaryDto> {
    const request = await prisma.organizerRequest.create({
      data: {
        organizerId,
        venueId: input.venue_id,
        title: input.title,
        artistName: input.artist_name,
        description: input.description,
        startsAt: new Date(input.starts_at),
        endsAt: new Date(input.ends_at),
        plannedPublishAt: input.planned_publish_at
          ? new Date(input.planned_publish_at)
          : null,
        gateCount: input.gate_count,
        checkerCount: input.checker_count,
        pressKitUrl: input.press_kit_url,
        artistBioImageUrl: input.artist_bio_image_url,
        ticketTypes: input.ticket_types as unknown as Prisma.InputJsonValue,
        status: ApprovalStatus.PENDING,
      },
    });

    // Có press kit → tự động sinh Artist Bio bằng AI (không chặn việc nộp hồ sơ).
    if (input.press_kit_url) {
      await this.kickoffArtistBio(request.id, organizerId, input.press_kit_url, input.artist_name);
    }

    return mapRequestSummary(request);
  }

  // Tạo bio job PENDING + enqueue. Lỗi enqueue chỉ đánh dấu FAILED, KHÔNG ném ra ngoài.
  private async kickoffArtistBio(
    requestId: string,
    organizerId: string,
    pressKitUrl: string,
    artistName: string,
  ) {
    const bioJob = await prisma.artistBioJob.create({
      data: {
        organizerRequestId: requestId,
        requestedById: organizerId,
        sourceFileUrl: pressKitUrl,
        status: "PENDING",
      },
    });
    await prisma.organizerRequest.update({
      where: { id: requestId },
      data: { bioStatus: "PENDING" },
    });

    try {
      await enqueueAiBio({ job_id: bioJob.id, organizer_request_id: requestId, artist_name: artistName });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await prisma.artistBioJob.update({
        where: { id: bioJob.id },
        data: { status: "FAILED", errorMessage: `Enqueue failed: ${message}` },
      });
      await prisma.organizerRequest.update({
        where: { id: requestId },
        data: { bioStatus: "FAILED" },
      });
    }
  }

  async getRequest(
    organizerId: string,
    requestId: string,
  ): Promise<OrganizerRequestDetailDto | null> {
    const request = await prisma.organizerRequest.findFirst({
      where: { id: requestId, organizerId },
    });

    return request ? mapRequestDetail(request) : null;
  }

  async listConcerts(
    organizerId: string,
    query: ListQuery,
  ): Promise<Page<OrganizerConcertSummaryDto>> {
    const concerts = await prisma.concert.findMany({
      where: {
        organizerId,
        ...(query.status ? { status: query.status as ConcertStatus } : {}),
        ...(query.q
          ? {
              OR: [
                { title: { contains: query.q, mode: "insensitive" } },
                { artistName: { contains: query.q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: {
        venue: true,
        seatZones: { orderBy: { sortOrder: "asc" } },
        ticketTypes: { include: { seatZone: true }, orderBy: { price: "asc" } },
      },
      orderBy: { startsAt: "desc" },
      take: query.limit + 1,
    });

    return page(concerts.map(mapConcertSummary), query.limit);
  }

  async getOwnedConcertForUpdate(organizerId: string, concertId: string) {
    return prisma.concert.findFirst({
      where: { id: concertId, organizerId },
      select: {
        id: true,
        status: true,
        startsAt: true,
        endsAt: true,
      },
    });
  }

  async updateDraftConcert(
    concertId: string,
    input: UpdateConcertData,
  ): Promise<OrganizerConcertUpdateDto> {
    const concert = await prisma.concert.update({
      where: { id: concertId },
      data: input,
      select: {
        id: true,
        status: true,
        updatedAt: true,
      },
    });

    return {
      id: concert.id,
      status: concert.status,
      updated_at: concert.updatedAt.toISOString(),
    };
  }

  async createSeatZone(
    concertId: string,
    input: CreateOrganizerSeatZoneInput,
  ): Promise<OrganizerSeatZoneDto> {
    const zone = await prisma.seatZone.create({
      data: {
        concertId,
        code: input.code,
        name: input.name,
        description: input.description,
        capacity: input.capacity,
        svgPath: input.svg_path,
        sortOrder: input.sort_order,
      },
    });

    return mapSeatZone(zone);
  }

  async getSeatZoneCapacityUsage(
    organizerId: string,
    concertId: string,
    seatZoneId: string,
  ) {
    const zone = await prisma.seatZone.findFirst({
      where: {
        id: seatZoneId,
        concertId,
        concert: { organizerId },
      },
      include: {
        ticketTypes: { select: { id: true, totalQuantity: true } },
      },
    });

    if (!zone) return null;

    return {
      capacity: zone.capacity,
      configured_quantity: zone.ticketTypes.reduce(
        (total, item) => total + item.totalQuantity,
        0,
      ),
    };
  }

  async createTicketType(
    concertId: string,
    input: CreateOrganizerTicketTypeInput,
  ): Promise<OrganizerTicketTypeDto> {
    const ticketType = await prisma.ticketType.create({
      data: {
        concertId,
        seatZoneId: input.seat_zone_id,
        name: input.name,
        description: input.description,
        price: input.price.amount,
        currency: "VND",
        totalQuantity: input.total_quantity,
        maxPerUser: input.max_per_user,
        saleStartAt: new Date(input.sale_start_at),
        saleEndAt: new Date(input.sale_end_at),
        status: TicketTypeStatus.DRAFT,
      },
      include: { seatZone: true },
    });

    return mapTicketType(ticketType);
  }

  async createDeletionRequest(
    organizerId: string,
    concertId: string,
    reason?: string,
  ): Promise<DeletionRequestDto> {
    const request = await prisma.concertDeletionRequest.create({
      data: {
        organizerId,
        concertId,
        reason,
        status: ApprovalStatus.PENDING,
      },
    });

    return {
      id: request.id,
      concert_id: request.concertId,
      status: request.status,
      created_at: request.createdAt.toISOString(),
    };
  }

  async getAnalytics(
    organizerId: string,
    concertId: string,
  ): Promise<AnalyticsDto | null> {
    const concert = await prisma.concert.findFirst({
      where: { id: concertId, organizerId },
      select: {
        id: true,
        ticketTypes: {
          select: { totalQuantity: true },
        },
      },
    });

    if (!concert) return null;

    const [orders, ticketsSold, checkedIn] = await Promise.all([
      prisma.order.aggregate({
        where: { concertId, status: OrderStatus.CONFIRMED },
        _sum: { totalAmount: true },
      }),
      prisma.ticket.count({ where: { concertId } }),
      prisma.ticket.count({ where: { concertId, status: "CHECKED_IN" } }),
    ]);

    const revenue = Number(orders._sum.totalAmount ?? 0);
    const ticketsTotal = concert.ticketTypes.reduce(
      (total, item) => total + item.totalQuantity,
      0,
    );

    return {
      concert_id: concert.id,
      revenue: { amount: revenue, currency: "VND" },
      tickets_sold: ticketsSold,
      tickets_total: ticketsTotal,
      checked_in: checkedIn,
      check_in_rate: ticketsSold > 0 ? checkedIn / ticketsSold : 0,
    };
  }

  async listOrders(
    organizerId: string,
    query: ListQuery,
  ): Promise<Page<OrganizerOrderDto>> {
    const orders = await prisma.order.findMany({
      where: {
        concert: { organizerId },
        ...(query.concert_id ? { concertId: query.concert_id } : {}),
        ...(query.status ? { status: query.status as OrderStatus } : {}),
      },
      include: {
        concert: { select: { title: true } },
      },
      orderBy: { createdAt: "desc" },
      take: query.limit + 1,
    });

    return page(
      orders.map((order) => ({
        id: order.id,
        concert_id: order.concertId,
        concert_title: order.concert.title,
        status: order.status,
        total_amount: {
          amount: Number(order.totalAmount),
          currency: order.currency,
        },
        created_at: order.createdAt.toISOString(),
        confirmed_at: order.confirmedAt?.toISOString(),
      })),
      query.limit,
    );
  }

  async getTicketTypeInventory(
    organizerId: string,
    ticketTypeId: string,
  ): Promise<OrganizerInventoryDto | null> {
    const ticketType = await prisma.ticketType.findFirst({
      where: {
        id: ticketTypeId,
        concert: { organizerId },
      },
      select: {
        id: true,
        concertId: true,
        totalQuantity: true,
        heldQuantity: true,
        soldQuantity: true,
      },
    });

    if (!ticketType) return null;

    return {
      ticket_type_id: ticketType.id,
      concert_id: ticketType.concertId,
      total: ticketType.totalQuantity,
      held: ticketType.heldQuantity,
      sold: ticketType.soldQuantity,
      available: Math.max(
        ticketType.totalQuantity -
          ticketType.heldQuantity -
          ticketType.soldQuantity,
        0,
      ),
    };
  }

  async listCheckerAccounts(
    organizerId: string,
    query: ListQuery,
  ): Promise<Page<CheckerAccountDto>> {
    const accounts = await prisma.concertCheckerAccount.findMany({
      where: {
        concert: {
          organizerId,
          ...(query.concert_id ? { id: query.concert_id } : {}),
        },
      },
      include: {
        concert: { select: { title: true } },
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: query.limit + 1,
    });

    return page(
      accounts.map((account) => ({
        id: account.id,
        concert_id: account.concertId,
        concert_title: account.concert.title,
        user_id: account.user.id,
        email: account.user.email,
        full_name: account.user.fullName,
        status: account.user.status,
        created_at: account.createdAt.toISOString(),
      })),
      query.limit,
    );
  }

  async listGuests(
    organizerId: string,
    concertId: string,
    query: ListQuery,
  ): Promise<Page<OrganizerGuestDto> | null> {
    const concert = await prisma.concert.findFirst({
      where: { id: concertId, organizerId },
      select: { id: true },
    });

    if (!concert) return null;

    const guests = await prisma.guestList.findMany({
      where: {
        concertId,
        ...(query.status ? { status: query.status as GuestStatus } : {}),
        ...(query.seat_zone_id ? { seatZoneId: query.seat_zone_id } : {}),
        ...(query.q
          ? {
              OR: [
                { fullName: { contains: query.q, mode: "insensitive" } },
                { phone: { contains: query.q, mode: "insensitive" } },
                { email: { contains: query.q, mode: "insensitive" } },
                { code: { contains: query.q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { fullName: "asc" },
      take: query.limit + 1,
    });

    return page(
      guests.map((guest) => ({
        id: guest.id,
        concert_id: guest.concertId,
        seat_zone_id: guest.seatZoneId,
        full_name: guest.fullName,
        phone: guest.phone,
        email: guest.email,
        code: guest.code,
        status: guest.status,
        checked_in_at: guest.checkedInAt?.toISOString(),
        created_at: guest.createdAt.toISOString(),
      })),
      query.limit,
    );
  }
}

function page<T extends { id: string }>(items: T[], limit: number): Page<T> {
  const hasMore = items.length > limit;
  const sliced = hasMore ? items.slice(0, limit) : items;

  return {
    items: sliced,
    nextCursor: hasMore ? (sliced[sliced.length - 1]?.id ?? null) : null,
    hasMore,
    limit,
  };
}

function mapVenue(
  venue: Prisma.VenueGetPayload<Record<string, never>>,
): OrganizerVenueDto {
  return {
    id: venue.id,
    name: venue.name,
    address: venue.address,
    city: venue.city,
    capacity: venue.capacity ?? undefined,
    map_url: venue.mapUrl ?? undefined,
  };
}

function mapRequestSummary(
  request: Prisma.OrganizerRequestGetPayload<Record<string, never>>,
): OrganizerRequestSummaryDto {
  return {
    id: request.id,
    title: request.title,
    artist_name: request.artistName,
    venue_id: request.venueId,
    starts_at: request.startsAt.toISOString(),
    ends_at: request.endsAt.toISOString(),
    planned_publish_at: request.plannedPublishAt?.toISOString(),
    gate_count: request.gateCount,
    checker_count: request.checkerCount,
    status: request.status,
    concert_id: request.concertId,
    created_at: request.createdAt.toISOString(),
  };
}

function mapRequestDetail(
  request: Prisma.OrganizerRequestGetPayload<Record<string, never>>,
): OrganizerRequestDetailDto {
  return {
    ...mapRequestSummary(request),
    description: request.description ?? undefined,
    press_kit_url: request.pressKitUrl ?? undefined,
    artist_bio: request.artistBio ?? null,
    bio_status: request.bioStatus ?? null,
    artist_bio_image_url: request.artistBioImageUrl ?? null,
    ticket_types: request.ticketTypes,
    reviewed_by: request.reviewedById,
    reviewed_at: request.reviewedAt?.toISOString(),
    review_note: request.reviewNote ?? undefined,
    updated_at: request.updatedAt.toISOString(),
  };
}

function mapConcertSummary(
  concert: Prisma.ConcertGetPayload<{
    include: {
      venue: true;
      seatZones: true;
      ticketTypes: { include: { seatZone: true } };
    };
  }>,
): OrganizerConcertSummaryDto {
  return {
    id: concert.id,
    title: concert.title,
    slug: concert.slug,
    description: concert.description ?? undefined,
    artist_name: concert.artistName,
    artist_bio: concert.artistBio ?? undefined,
    status: concert.status,
    starts_at: concert.startsAt.toISOString(),
    ends_at: concert.endsAt.toISOString(),
    planned_publish_at: concert.plannedPublishAt?.toISOString(),
    cover_image_url: concert.coverImageUrl ?? undefined,
    venue: {
      id: concert.venue.id,
      name: concert.venue.name,
      city: concert.venue.city,
    },
    seat_zones: concert.seatZones.map(mapSeatZone),
    ticket_types: concert.ticketTypes.map(mapTicketType),
  };
}

function mapSeatZone(
  zone: Prisma.SeatZoneGetPayload<Record<string, never>>,
): OrganizerSeatZoneDto {
  return {
    id: zone.id,
    code: zone.code,
    name: zone.name,
    description: zone.description ?? undefined,
    capacity: zone.capacity,
    svg_path: zone.svgPath ?? undefined,
    sort_order: zone.sortOrder,
  };
}

function mapTicketType(
  ticketType: Prisma.TicketTypeGetPayload<{ include: { seatZone: true } }>,
): OrganizerTicketTypeDto {
  const total = ticketType.totalQuantity;
  const held = ticketType.heldQuantity;
  const sold = ticketType.soldQuantity;

  return {
    id: ticketType.id,
    seat_zone_id: ticketType.seatZoneId,
    name: ticketType.name,
    description: ticketType.description ?? undefined,
    zone_code: ticketType.seatZone.code,
    zone_name: ticketType.seatZone.name,
    price: {
      amount: Number(ticketType.price),
      currency: "VND",
    },
    total_quantity: total,
    held_quantity: held,
    sold_quantity: sold,
    available_quantity: Math.max(total - held - sold, 0),
    max_per_user: ticketType.maxPerUser,
    sale_start_at: ticketType.saleStartAt.toISOString(),
    sale_end_at: ticketType.saleEndAt.toISOString(),
    status: ticketType.status,
  };
}

export function toConcertUpdateData(
  input: UpdateOrganizerConcertInput,
): UpdateConcertData {
  return {
    venueId: input.venue_id,
    title: input.title,
    description: nullable(input.description),
    artistName: input.artist_name,
    artistBio: nullable(input.artist_bio),
    startsAt: input.starts_at ? new Date(input.starts_at) : undefined,
    endsAt: input.ends_at ? new Date(input.ends_at) : undefined,
    plannedPublishAt: input.planned_publish_at
      ? new Date(input.planned_publish_at)
      : undefined,
    coverImageUrl: nullable(input.cover_image_url),
    seatMapUrl: nullable(input.seat_map_url),
    artistBioImageUrl: nullable(input.artist_bio_image_url),
  };
}

function nullable(value: string | undefined): string | null | undefined {
  return value === undefined ? undefined : value;
}
