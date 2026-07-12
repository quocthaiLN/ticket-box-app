import {
  ApprovalStatus,
  ConcertStatus,
  Prisma,
  TicketTypeStatus,
  UserRole,
  UserStatus,
  prisma,
} from "@ticketbox/database";
import { Errors } from "../../shared/http/problem-details.js";
import { CatalogRepository } from "../catalog/catalog.repository.js";
import type { AdminListQuery, StoredTicketType } from "./organizer-admin.schema.js";

export type Page<T> = {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
  limit: number;
};

export type AdminRequestSummaryDto = {
  id: string;
  organizer_id: string;
  organizer?: {
    id: string;
    full_name: string;
    email: string;
  };
  title: string;
  artist_name: string;
  venue_id: string;
  venue?: {
    id: string;
    name: string;
    city: string;
  };
  starts_at: string;
  ends_at: string;
  gate_count: number;
  checker_count: number;
  status: string;
  concert_id?: string | null;
  created_at: string;
};

export type AdminRequestDetailDto = AdminRequestSummaryDto & {
  description?: string;
  planned_publish_at?: string;
  press_kit_url?: string;
  // Sơ đồ chỗ ngồi organizer upload lúc nộp hồ sơ — admin xem trước khi duyệt.
  seat_map_url?: string;
  seat_map_image_url?: string;
  artist_bio?: string | null;
  bio_status?: string | null;
  artist_bio_image_url?: string | null;
  artists?: Prisma.JsonValue | null;
  ticket_types: unknown;
  review_note?: string;
  reviewed_by?: string | null;
  reviewed_at?: string;
  updated_at: string;
};

export type AdminDeletionRequestDto = {
  id: string;
  concert_id: string;
  concert?: {
    id: string;
    title: string;
    cover_image_url?: string;
  };
  organizer_id: string;
  organizer?: {
    id: string;
    full_name: string;
    email: string;
  };
  reason?: string;
  status: string;
  review_note?: string;
  reviewed_by?: string | null;
  reviewed_at?: string;
  created_at: string;
};

export type CheckerAccountListDto = {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  status: string;
  created_at: string;
};

export type ApprovedCheckerCredential = {
  user_id: string;
  email: string;
  password: string;
};

export type ApproveResultDto = {
  concert: { id: string; title: string; slug: string; status: string };
  seat_zones_created: number;
  ticket_types_created: number;
  gates_created: number;
  checker_accounts: ApprovedCheckerCredential[];
};

export type ProvisionZone = { code: string; name: string; capacity: number };

export type ProvisionChecker = {
  email: string;
  fullName: string;
  passwordHash: string;
  plaintext: string;
};

export type ApproveProvisionInput = {
  requestId: string;
  adminId: string;
  // Id sinh trước ở service để slug mang suffix 5 ký tự cuối của id.
  concertId: string;
  slug: string;
  zones: ProvisionZone[];
  ticketTypes: StoredTicketType[];
  checkers: ProvisionChecker[];
};

export class OrganizerAdminRepository {
  private readonly catalog = new CatalogRepository();

  // ── Organizer requests ────────────────────────────────────────────────────
  async listRequests(query: AdminListQuery): Promise<Page<AdminRequestSummaryDto>> {
    const requests = await prisma.organizerRequest.findMany({
      where: query.status ? { status: query.status as ApprovalStatus } : {},
      include: {
        venue: { select: { id: true, name: true, city: true } },
        organizer: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: query.limit + 1,
    });

    return page(requests.map(mapRequestSummary), query.limit);
  }

  async getRequestDetail(requestId: string): Promise<AdminRequestDetailDto | null> {
    const request = await prisma.organizerRequest.findUnique({
      where: { id: requestId },
      include: {
        venue: { select: { id: true, name: true, city: true } },
        organizer: { select: { id: true, fullName: true, email: true } },
      },
    });

    return request ? mapRequestDetail(request) : null;
  }

  async getRequestStatus(requestId: string) {
    return prisma.organizerRequest.findUnique({
      where: { id: requestId },
      select: { id: true, status: true },
    });
  }

  /**
   * Approve = vật chất hóa hồ sơ thành concert vận hành đầy đủ trong một
   * transaction (all-or-nothing). Mọi mật khẩu checker đã được hash sẵn ở
   * service; ở đây chỉ ghi DB.
   */
  async approveRequest(input: ApproveProvisionInput): Promise<ApproveResultDto> {
    return prisma.$transaction(async (tx) => {
      const request = await tx.organizerRequest.findUnique({
        where: { id: input.requestId },
      });

      // Chặn approve hai lần (race): kiểm tra lại trạng thái trong transaction.
      if (!request || request.status !== ApprovalStatus.PENDING) {
        throw Errors.organizerRequestNotPending();
      }

      const concert = await tx.concert.create({
        data: {
          id: input.concertId,
          venueId: request.venueId,
          organizerId: request.organizerId,
          title: request.title,
          slug: input.slug,
          description: request.description ?? undefined,
          artistName: request.artistName,
          artistBio: request.artistBio ?? undefined, // mang bio AI (sinh từ press kit) vào concert
          artistBioImageUrl: request.artistBioImageUrl ?? undefined, // ảnh nghệ sĩ tách từ press kit
          coverImageUrl: request.coverImageUrl ?? undefined, // ảnh concert tách từ press kit (trang 1)
          seatMapUrl: request.seatMapUrl ?? undefined, // SVG sơ đồ (trang mua vé) organizer upload lúc nộp hồ sơ
          seatMapImageUrl: request.seatMapImageUrl ?? undefined, // ảnh sơ đồ (trang thông tin concert)
          // Danh sách nghệ sĩ AI tách từ press kit — mang nguyên sang concert.
          ...(request.artists !== null
            ? { artists: request.artists as Prisma.InputJsonValue }
            : {}),
          startsAt: request.startsAt,
          endsAt: request.endsAt,
          plannedPublishAt: request.plannedPublishAt ?? undefined,
          status: ConcertStatus.DRAFT,
        },
        select: { id: true, title: true, slug: true, status: true },
      });

      // Liên kết các bio job của hồ sơ sang concert vừa tạo (giữ vết xử lý/audit).
      await tx.artistBioJob.updateMany({
        where: { organizerRequestId: request.id },
        data: { concertId: concert.id },
      });

      const zoneIdByCode = new Map<string, string>();
      const seatZoneIds: string[] = [];
      let sortOrder = 0;
      for (const zone of input.zones) {
        const created = await tx.seatZone.create({
          data: {
            concertId: concert.id,
            code: zone.code,
            name: zone.name,
            capacity: zone.capacity,
            sortOrder: sortOrder++,
          },
          select: { id: true },
        });
        zoneIdByCode.set(zone.code, created.id);
        seatZoneIds.push(created.id);
      }

      for (const ticketType of input.ticketTypes) {
        const seatZoneId = zoneIdByCode.get(ticketType.zone_code);
        if (!seatZoneId) {
          throw Errors.seatZoneNotFoundForConcert();
        }
        await tx.ticketType.create({
          data: {
            concertId: concert.id,
            seatZoneId,
            name: ticketType.name,
            price: new Prisma.Decimal(ticketType.price.amount),
            currency: "VND",
            totalQuantity: ticketType.total_quantity,
            maxPerUser: ticketType.max_per_user,
            saleStartAt: new Date(ticketType.sale_start_at),
            saleEndAt: new Date(ticketType.sale_end_at),
            status: TicketTypeStatus.DRAFT,
          },
        });
      }

      const gateIds: string[] = [];
      for (let i = 1; i <= request.gateCount; i++) {
        const gate = await tx.checkinGate.create({
          data: {
            concertId: concert.id,
            code: `GATE-${i}`,
            name: `Cổng ${i}`,
            sortOrder: i - 1,
          },
          select: { id: true },
        });
        gateIds.push(gate.id);
      }

      // Hồ sơ organizer chỉ khai báo số cổng, chưa có UI gán zone cho từng cổng.
      // Mặc định mỗi cổng phục vụ mọi zone để payment success luôn phát hành được ticket.
      for (const gateId of gateIds) {
        for (const seatZoneId of seatZoneIds) {
          await tx.checkinGateZone.create({
            data: {
              gateId,
              seatZoneId,
              concertId: concert.id,
            },
          });
        }
      }

      const checkerAccounts: ApprovedCheckerCredential[] = [];
      for (const checker of input.checkers) {
        const user = await tx.user.create({
          data: {
            email: checker.email,
            passwordHash: checker.passwordHash,
            fullName: checker.fullName,
            role: UserRole.CHECKER,
            status: UserStatus.ACTIVE,
          },
          select: { id: true, email: true },
        });
        await tx.concertCheckerAccount.create({
          data: {
            concertId: concert.id,
            userId: user.id,
            organizerRequestId: request.id,
          },
        });
        checkerAccounts.push({
          user_id: user.id,
          email: user.email,
          password: checker.plaintext,
        });
      }

      await tx.organizerRequest.update({
        where: { id: request.id },
        data: {
          status: ApprovalStatus.APPROVED,
          reviewedById: input.adminId,
          reviewedAt: new Date(),
          concertId: concert.id,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: input.adminId,
          action: "APPROVE_ORGANIZER_REQUEST",
          entityType: "organizer_request",
          entityId: request.id,
          metadata: { concert_id: concert.id } as Prisma.InputJsonObject,
        },
      });

      return {
        concert: {
          id: concert.id,
          title: concert.title,
          slug: concert.slug,
          status: concert.status,
        },
        seat_zones_created: input.zones.length,
        ticket_types_created: input.ticketTypes.length,
        gates_created: request.gateCount,
        checker_accounts: checkerAccounts,
      };
    });
  }

  async rejectRequest(
    requestId: string,
    adminId: string,
    reviewNote?: string,
  ): Promise<{ id: string; status: string; reviewed_at: string }> {
    const updated = await prisma.organizerRequest.update({
      where: { id: requestId },
      data: {
        status: ApprovalStatus.REJECTED,
        reviewedById: adminId,
        reviewedAt: new Date(),
        reviewNote,
      },
      select: { id: true, status: true, reviewedAt: true },
    });

    await prisma.auditLog.create({
      data: {
        actorUserId: adminId,
        action: "REJECT_ORGANIZER_REQUEST",
        entityType: "organizer_request",
        entityId: requestId,
        metadata: { review_note: reviewNote ?? null } as Prisma.InputJsonObject,
      },
    });

    return {
      id: updated.id,
      status: updated.status,
      reviewed_at: (updated.reviewedAt ?? new Date()).toISOString(),
    };
  }

  // ── Concert deletion requests ─────────────────────────────────────────────
  async listDeletionRequests(query: AdminListQuery): Promise<Page<AdminDeletionRequestDto>> {
    const requests = await prisma.concertDeletionRequest.findMany({
      where: {
        ...(query.status ? { status: query.status as ApprovalStatus } : {}),
        ...(query.concert_id ? { concertId: query.concert_id } : {}),
      },
      include: {
        concert: { select: { id: true, title: true, coverImageUrl: true } },
        organizer: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: query.limit + 1,
    });

    return page(requests.map(mapDeletionRequest), query.limit);
  }

  async getDeletionRequest(requestId: string) {
    return prisma.concertDeletionRequest.findUnique({
      where: { id: requestId },
      select: { id: true, concertId: true, status: true },
    });
  }

  /**
   * Approve xóa concert: tái dùng `CatalogRepository.setConcertStatus` —
   * nơi DUY NHẤT vô hiệu hóa checker (set `CANCELLED` kéo theo `DISABLED`),
   * sau đó đánh dấu request `APPROVED`.
   */
  async approveDeletion(
    requestId: string,
    concertId: string,
    adminId: string,
  ): Promise<{ id: string; concert_id: string; concert_status: string; status: string; reviewed_at: string }> {
    const concert = await this.catalog.setConcertStatus(concertId, "CANCELLED");

    const updated = await prisma.concertDeletionRequest.update({
      where: { id: requestId },
      data: {
        status: ApprovalStatus.APPROVED,
        reviewedById: adminId,
        reviewedAt: new Date(),
      },
      select: { id: true, concertId: true, status: true, reviewedAt: true },
    });

    await prisma.auditLog.create({
      data: {
        actorUserId: adminId,
        action: "APPROVE_CONCERT_DELETION",
        entityType: "concert_deletion_request",
        entityId: requestId,
        metadata: { concert_id: concertId } as Prisma.InputJsonObject,
      },
    });

    return {
      id: updated.id,
      concert_id: updated.concertId,
      concert_status: concert.status,
      status: updated.status,
      reviewed_at: (updated.reviewedAt ?? new Date()).toISOString(),
    };
  }

  async rejectDeletion(
    requestId: string,
    adminId: string,
    reviewNote?: string,
  ): Promise<{ id: string; status: string; reviewed_at: string }> {
    const updated = await prisma.concertDeletionRequest.update({
      where: { id: requestId },
      data: {
        status: ApprovalStatus.REJECTED,
        reviewedById: adminId,
        reviewedAt: new Date(),
        reviewNote,
      },
      select: { id: true, status: true, reviewedAt: true },
    });

    await prisma.auditLog.create({
      data: {
        actorUserId: adminId,
        action: "REJECT_CONCERT_DELETION",
        entityType: "concert_deletion_request",
        entityId: requestId,
        metadata: { review_note: reviewNote ?? null } as Prisma.InputJsonObject,
      },
    });

    return {
      id: updated.id,
      status: updated.status,
      reviewed_at: (updated.reviewedAt ?? new Date()).toISOString(),
    };
  }

  // ── Checker accounts ──────────────────────────────────────────────────────
  async concertExists(concertId: string): Promise<boolean> {
    const concert = await prisma.concert.findUnique({
      where: { id: concertId },
      select: { id: true },
    });
    return Boolean(concert);
  }

  async listCheckerAccounts(
    concertId: string,
    query: AdminListQuery,
  ): Promise<Page<CheckerAccountListDto>> {
    const accounts = await prisma.concertCheckerAccount.findMany({
      where: { concertId },
      include: {
        user: { select: { id: true, email: true, fullName: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
      take: query.limit + 1,
    });

    return page(
      accounts.map((account) => ({
        id: account.id,
        user_id: account.user.id,
        email: account.user.email,
        full_name: account.user.fullName,
        status: account.user.status,
        created_at: account.createdAt.toISOString(),
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
    nextCursor: hasMore ? sliced[sliced.length - 1]?.id ?? null : null,
    hasMore,
    limit,
  };
}

function mapRequestSummary(
  request: Prisma.OrganizerRequestGetPayload<Record<string, never>> & {
    venue?: { id: string; name: string; city: string };
    organizer?: { id: string; fullName: string; email: string };
  },
): AdminRequestSummaryDto {
  return {
    id: request.id,
    organizer_id: request.organizerId,
    organizer: request.organizer
      ? {
          id: request.organizer.id,
          full_name: request.organizer.fullName,
          email: request.organizer.email,
        }
      : undefined,
    title: request.title,
    artist_name: request.artistName,
    venue_id: request.venueId,
    venue: "venue" in request && request.venue
      ? {
          id: request.venue.id,
          name: request.venue.name,
          city: request.venue.city,
        }
      : undefined,
    starts_at: request.startsAt.toISOString(),
    ends_at: request.endsAt.toISOString(),
    gate_count: request.gateCount,
    checker_count: request.checkerCount,
    status: request.status,
    concert_id: request.concertId,
    created_at: request.createdAt.toISOString(),
  };
}

function mapRequestDetail(
  request: Prisma.OrganizerRequestGetPayload<Record<string, never>> & {
    venue?: { id: string; name: string; city: string };
    organizer?: { id: string; fullName: string; email: string };
  },
): AdminRequestDetailDto {
  return {
    ...mapRequestSummary(request),
    description: request.description ?? undefined,
    planned_publish_at: request.plannedPublishAt?.toISOString(),
    press_kit_url: request.pressKitUrl ?? undefined,
    seat_map_url: request.seatMapUrl ?? undefined,
    seat_map_image_url: request.seatMapImageUrl ?? undefined,
    artist_bio: request.artistBio ?? null,
    bio_status: request.bioStatus ?? null,
    artist_bio_image_url: request.artistBioImageUrl ?? null,
    artists: request.artists ?? null,
    ticket_types: request.ticketTypes,
    review_note: request.reviewNote ?? undefined,
    reviewed_by: request.reviewedById,
    reviewed_at: request.reviewedAt?.toISOString(),
    updated_at: request.updatedAt.toISOString(),
  };
}

function mapDeletionRequest(
  request: Prisma.ConcertDeletionRequestGetPayload<Record<string, never>> & {
    concert?: { id: string; title: string; coverImageUrl: string | null };
    organizer?: { id: string; fullName: string; email: string };
  },
): AdminDeletionRequestDto {
  return {
    id: request.id,
    concert_id: request.concertId,
    concert: request.concert
      ? {
          id: request.concert.id,
          title: request.concert.title,
          cover_image_url: request.concert.coverImageUrl ?? undefined,
        }
      : undefined,
    organizer_id: request.organizerId,
    organizer: request.organizer
      ? {
          id: request.organizer.id,
          full_name: request.organizer.fullName,
          email: request.organizer.email,
        }
      : undefined,
    reason: request.reason ?? undefined,
    status: request.status,
    review_note: request.reviewNote ?? undefined,
    reviewed_by: request.reviewedById,
    reviewed_at: request.reviewedAt?.toISOString(),
    created_at: request.createdAt.toISOString(),
  };
}
