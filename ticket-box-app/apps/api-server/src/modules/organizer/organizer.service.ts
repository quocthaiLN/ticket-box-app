import { ConcertStatus } from "@ticketbox/database";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ApiError, Errors } from "../../shared/http/problem-details.js";
import { extractDriveFolderId } from "../../shared/utils/drive.js";
import { buildConcertSlug } from "../../shared/utils/slug.js";
import {
  OrganizerRepository,
  toConcertUpdateData,
} from "./organizer.repository.js";
import type {
  ApprovalStatusValue,
  ConcertStatusValue,
  CreateDeletionRequestInput,
  CreateOrganizerSeatZoneInput,
  CreateOrganizerTicketTypeInput,
  CreateOrganizerRequestInput,
  GuestStatusValue,
  ListQuery,
  OrderStatusValue,
  UpdateOrganizerConcertInput,
} from "./organizer.schema.js";

// 0h (giờ VN) của ngày diễn = thời điểm cron import chạy. BTC chỉ sửa folder trước mốc này.
function guestFolderEditCutoff(startsAt: Date): Date {
  const ICT_OFFSET = 7 * 60 * 60 * 1000;
  const wall = startsAt.getTime() + ICT_OFFSET;
  const dayStartWall = Math.floor(wall / 86_400_000) * 86_400_000;
  return new Date(dayStartWall - ICT_OFFSET);
}

export class OrganizerService {
  constructor(private readonly repository = new OrganizerRepository()) {}

  listVenues(query: ListQuery) {
    return this.repository.listVenues(query);
  }

  listRequests(organizerId: string, query: ListQuery) {
    this.assertApprovalStatus(query.status);
    return this.repository.listRequests(organizerId, query);
  }

  async createRequest(organizerId: string, input: CreateOrganizerRequestInput) {
    this.assertTimeRange(input.starts_at, input.ends_at);
    if (input.planned_publish_at) {
      this.assertPlannedPublishAt(input.planned_publish_at, input.starts_at);
    }

    if (!(await this.repository.venueExists(input.venue_id))) {
      throw venueNotFound(input.venue_id);
    }

    return this.repository.createRequest(organizerId, input);
  }

  uploadCoverImage(
    organizerId: string,
    file: Buffer,
    input: { contentType?: string; fileName?: string },
  ) {
    return this.uploadPublicImage(organizerId, file, input, "covers", "cover");
  }

  uploadSeatMapImage(
    organizerId: string,
    file: Buffer,
    input: { contentType?: string; fileName?: string },
  ) {
    return this.uploadPublicImage(organizerId, file, input, "seat-maps", "seat-map");
  }

  private async uploadPublicImage(
    organizerId: string,
    file: Buffer,
    input: { contentType?: string; fileName?: string },
    folder: string,
    defaultName: string,
  ) {
    if (!organizerId) {
      throw Errors.unauthorized();
    }

    const extension = extensionForImageType(input.contentType);
    if (!extension) {
      throw Errors.fieldValidationError(
        "file",
        "Only JPEG, PNG, WebP, GIF, or SVG images are supported.",
      );
    }

    if (!file.length) {
      throw Errors.fieldValidationError("file", "Image file is required.");
    }

    const uploadDir = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      `../../../public/uploads/${folder}`,
    );
    await mkdir(uploadDir, { recursive: true });

    const safeBaseName = safeFileBaseName(input.fileName ?? defaultName);
    const objectKey = `uploads/${folder}/${Date.now()}-${randomUUID()}-${safeBaseName}${extension}`;
    await writeFile(path.resolve(uploadDir, path.basename(objectKey)), file);

    return {
      object_key: objectKey,
      url_path: `/${objectKey}`,
    };
  }

  async getRequest(organizerId: string, requestId: string) {
    const request = await this.repository.getRequest(organizerId, requestId);
    if (!request) {
      throw Errors.organizerRequestNotFound(requestId);
    }

    return request;
  }

  listConcerts(organizerId: string, query: ListQuery) {
    this.assertConcertStatus(query.status);
    return this.repository.listConcerts(organizerId, query);
  }

  async updateDraftConcert(
    organizerId: string,
    concertId: string,
    input: UpdateOrganizerConcertInput,
  ) {
    const concert = await this.repository.getOwnedConcertForUpdate(organizerId, concertId);
    if (!concert) {
      throw Errors.concertNotFound(concertId);
    }

    if (concert.status !== ConcertStatus.DRAFT) {
      throw Errors.concertNotEditable(concertId);
    }

    const startsAt = input.starts_at ?? concert.startsAt.toISOString();
    const endsAt = input.ends_at ?? concert.endsAt.toISOString();
    this.assertTimeRange(startsAt, endsAt);

    if (input.planned_publish_at) {
      this.assertPlannedPublishAt(input.planned_publish_at, startsAt);
    }

    if (input.venue_id && !(await this.repository.venueExists(input.venue_id))) {
      throw venueNotFound(input.venue_id);
    }

    // Đổi tên khi DRAFT: slug sinh lại theo title mới + suffix id, không cần redirect.
    const data = toConcertUpdateData(input);
    if (input.title) {
      data.slug = buildConcertSlug(input.title, concertId);
    }

    return this.repository.updateDraftConcert(concertId, data);
  }

  // Gán/sửa thư mục Drive khách mời. Cho phép mọi trạng thái concert, nhưng chỉ
  // trước 0h (giờ VN) ngày diễn — sau mốc đó cron import đã chạy nên khoá lại.
  async setGuestDriveFolder(
    organizerId: string,
    concertId: string,
    folderInput: string,
  ) {
    const concert = await this.repository.getOwnedConcertForUpdate(organizerId, concertId);
    if (!concert) {
      throw Errors.concertNotFound(concertId);
    }
    // Chỉ khoá khi concert đã PUBLISHED (sẽ được cron nhập) và quá 0h ngày diễn.
    // Concert DRAFT chưa được nhập nên luôn cho sửa.
    if (
      concert.status === ConcertStatus.PUBLISHED &&
      Date.now() >= guestFolderEditCutoff(concert.startsAt).getTime()
    ) {
      throw Errors.guestFolderLocked();
    }

    const trimmed = folderInput.trim();
    const folderId = trimmed ? extractDriveFolderId(trimmed) : null;
    if (trimmed && !folderId) {
      throw Errors.fieldValidationError(
        "guest_drive_folder_id",
        "guest_drive_folder_id must be a Google Drive folder link or folder ID.",
      );
    }

    return this.repository.setGuestDriveFolder(concertId, folderId);
  }

  async createSeatZone(
    organizerId: string,
    concertId: string,
    input: CreateOrganizerSeatZoneInput,
  ) {
    const concert = await this.repository.getOwnedConcertForUpdate(organizerId, concertId);
    if (!concert) {
      throw Errors.concertNotFound(concertId);
    }

    if (concert.status !== ConcertStatus.DRAFT) {
      throw Errors.concertNotEditable(concertId);
    }

    return this.repository.createSeatZone(concertId, input);
  }

  async createTicketType(
    organizerId: string,
    concertId: string,
    input: CreateOrganizerTicketTypeInput,
  ) {
    const concert = await this.repository.getOwnedConcertForUpdate(organizerId, concertId);
    if (!concert) {
      throw Errors.concertNotFound(concertId);
    }

    if (concert.status !== ConcertStatus.DRAFT) {
      throw Errors.concertNotEditable(concertId);
    }

    this.assertTimeRange(input.sale_start_at, input.sale_end_at);

    const usage = await this.repository.getSeatZoneCapacityUsage(
      organizerId,
      concertId,
      input.seat_zone_id,
    );

    if (!usage) {
      throw Errors.seatZoneNotFound(input.seat_zone_id);
    }

    if (usage.configured_quantity + input.total_quantity > usage.capacity) {
      throw Errors.zoneCapacityExceeded();
    }

    return this.repository.createTicketType(concertId, input);
  }

  async createDeletionRequest(
    organizerId: string,
    concertId: string,
    input: CreateDeletionRequestInput,
  ) {
    const concert = await this.repository.getOwnedConcertForUpdate(organizerId, concertId);
    if (!concert) {
      throw Errors.concertNotFound(concertId);
    }

    return this.repository.createDeletionRequest(organizerId, concertId, input.reason);
  }

  async getAnalytics(organizerId: string, concertId: string) {
    const analytics = await this.repository.getAnalytics(organizerId, concertId);
    if (!analytics) {
      throw Errors.concertNotFound(concertId);
    }

    return analytics;
  }

  listOrders(organizerId: string, query: ListQuery) {
    this.assertOrderStatus(query.status);
    return this.repository.listOrders(organizerId, query);
  }

  async getTicketTypeInventory(organizerId: string, ticketTypeId: string) {
    const inventory = await this.repository.getTicketTypeInventory(organizerId, ticketTypeId);
    if (!inventory) {
      throw Errors.ticketTypeNotFound(ticketTypeId);
    }

    return inventory;
  }

  listCheckerAccounts(organizerId: string, query: ListQuery) {
    return this.repository.listCheckerAccounts(organizerId, query);
  }

  async listGuests(organizerId: string, concertId: string, query: ListQuery) {
    this.assertGuestStatus(query.status);
    const guests = await this.repository.listGuests(organizerId, concertId, query);
    if (!guests) {
      throw Errors.concertNotFound(concertId);
    }

    return guests;
  }

  private assertTimeRange(startsAt: string, endsAt: string) {
    if (new Date(endsAt) <= new Date(startsAt)) {
      throw Errors.invalidConcertTimeRange();
    }
  }

  private assertPlannedPublishAt(plannedPublishAt: string, startsAt: string) {
    if (new Date(plannedPublishAt) > new Date(startsAt)) {
      throw Errors.fieldValidationError(
        "planned_publish_at",
        "planned_publish_at must be earlier than or equal to starts_at.",
      );
    }
  }

  private assertApprovalStatus(status?: string) {
    if (!status) return;
    if (!["PENDING", "APPROVED", "REJECTED"].includes(status)) {
      throw invalidQueryStatus("status must be one of PENDING, APPROVED, REJECTED.");
    }
  }

  private assertConcertStatus(status?: string) {
    if (!status) return;
    const allowed: ConcertStatusValue[] = ["DRAFT", "PUBLISHED", "CANCELLED", "COMPLETED"];
    if (!allowed.includes(status as ConcertStatusValue)) {
      throw invalidQueryStatus("status must be one of DRAFT, PUBLISHED, CANCELLED, COMPLETED.");
    }
  }

  private assertOrderStatus(status?: string) {
    if (!status) return;
    const allowed: OrderStatusValue[] = ["HELD", "CONFIRMED", "CANCELLED", "EXPIRED"];
    if (!allowed.includes(status as OrderStatusValue)) {
      throw invalidQueryStatus("status must be one of HELD, CONFIRMED, CANCELLED, EXPIRED.");
    }
  }

  private assertGuestStatus(status?: string) {
    if (!status) return;
    const allowed: GuestStatusValue[] = ["INVITED", "CHECKED_IN", "CANCELLED"];
    if (!allowed.includes(status as GuestStatusValue)) {
      throw invalidQueryStatus("status must be one of INVITED, CHECKED_IN, CANCELLED.");
    }
  }
}

function venueNotFound(id: string) {
  return new ApiError({
    title: "Venue not found",
    status: 404,
    code: "VENUE_NOT_FOUND",
    detail: `Venue ${id} was not found.`,
  });
}

function invalidQueryStatus(detail: string) {
  return new ApiError({
    title: "Invalid status",
    status: 400,
    code: "BAD_REQUEST",
    detail,
  });
}

function extensionForImageType(contentType?: string) {
  const normalized = contentType?.split(";")[0]?.trim().toLowerCase();
  const extensions: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/svg+xml": ".svg",
  };
  return normalized ? extensions[normalized] : undefined;
}

function safeFileBaseName(fileName: string) {
  const parsed = path.parse(fileName);
  const base = (parsed.name || "cover")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "cover";
}
