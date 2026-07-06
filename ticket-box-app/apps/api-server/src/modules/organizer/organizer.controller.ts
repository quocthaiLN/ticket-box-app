import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { cacheDelete, cacheDeletePattern } from "@ticketbox/redis";
import {
  uploadPressKit as storePressKit,
  uploadArtistImage as storeArtistImage,
} from "@ticketbox/storage";
import { collection, ok } from "../../shared/http/response.js";
import { ApiError, Errors } from "../../shared/http/problem-details.js";
import { catalogCacheKeys } from "../catalog/catalog.cache.js";
import {
  parseCreateDeletionRequestBody,
  parseCreateOrganizerSeatZoneBody,
  parseCreateOrganizerTicketTypeBody,
  parseCreateOrganizerRequestBody,
  parseListQuery,
  parseUpdateOrganizerConcertBody,
} from "./organizer.schema.js";
import { OrganizerService } from "./organizer.service.js";

// Bọc thao tác Supabase Storage: lỗi hạ tầng (project sai/bị xóa, DNS, key hết hạn)
// trả 503 kèm thông điệp rõ ràng thay vì 500 chung chung.
async function storageCall<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[organizer] Supabase storage error:", message);
    throw new ApiError({
      title: "Storage unavailable",
      status: 503,
      code: "storage_unavailable",
      detail:
        "Không tải được file lên kho lưu trữ (Supabase). Kiểm tra SUPABASE_URL/SERVICE_ROLE_KEY và bucket trong .env — " +
        message,
    });
  }
}

export class OrganizerController {
  constructor(private readonly service = new OrganizerService()) {}

  listVenues = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = parseListQuery(req.query);
      const page = await this.service.listVenues(query);
      res.json(toCollection(page, req.requestId));
    } catch (err) {
      next(err);
    }
  };

  listRequests = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = await this.service.listRequests(
        currentUserId(res),
        parseListQuery(req.query),
      );
      res.json(toCollection(page, req.requestId));
    } catch (err) {
      next(err);
    }
  };

  createRequest = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.createRequest(
        currentUserId(res),
        parseCreateOrganizerRequestBody(req.body),
      );
      res.status(201).json(ok(data, req.requestId));
    } catch (err) {
      next(err);
    }
  };

  // Upload PDF press kit (server-side) lên Supabase, trả object key để gắn vào hồ sơ.
  uploadPressKit = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const organizerId = currentUserId(res); // guard ORGANIZER ở router
      const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
      if (buffer.length === 0) {
        throw Errors.fieldValidationError("file", "Empty PDF upload.");
      }
      // Gom file theo organizer (concert chưa tồn tại lúc upload); UUID đảm bảo không trùng.
      const objectKey = await storageCall(() =>
        storePressKit(`${organizerId}/${randomUUID()}.pdf`, buffer),
      );
      res.status(201).json(ok({ object_key: objectKey }, req.requestId));
    } catch (err) {
      next(err);
    }
  };

  // Upload ảnh nghệ sĩ (server-side) lên Supabase public, trả object key + URL hiển thị.
  uploadArtistImage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const organizerId = currentUserId(res);
      const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
      if (buffer.length === 0) {
        throw Errors.fieldValidationError("file", "Empty image upload.");
      }
      const contentType = req.headers["content-type"] ?? "image/jpeg";
      // Gom ảnh theo organizer; UUID đảm bảo không trùng.
      const data = await storageCall(() =>
        storeArtistImage(
          `${organizerId}/${randomUUID()}.${imageExtension(contentType)}`,
          buffer,
          contentType,
        ),
      );
      res.status(201).json(ok(data, req.requestId));
    } catch (err) {
      next(err);
    }
  };

  uploadCoverImage = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const upload = await this.service.uploadCoverImage(
        currentUserId(res),
        Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0),
        {
          contentType: req.headers["content-type"],
          fileName:
            typeof req.headers["x-file-name"] === "string"
              ? req.headers["x-file-name"]
              : undefined,
        },
      );
      const origin = `${req.protocol}://${req.get("host")}`;
      res
        .status(201)
        .json(
          ok({ ...upload, url: `${origin}${upload.url_path}` }, req.requestId),
        );
    } catch (err) {
      next(err);
    }
  };

  getRequest = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.getRequest(
        currentUserId(res),
        req.params.request_id,
      );
      res.json(ok(data, req.requestId));
    } catch (err) {
      next(err);
    }
  };

  listConcerts = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = await this.service.listConcerts(
        currentUserId(res),
        parseListQuery(req.query),
      );
      res.json(toCollection(page, req.requestId));
    } catch (err) {
      next(err);
    }
  };

  updateDraftConcert = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const concertId = req.params.concert_id;
      const data = await this.service.updateDraftConcert(
        currentUserId(res),
        concertId,
        parseUpdateOrganizerConcertBody(req.body),
      );
      void invalidateConcertCache(concertId);
      res.json(ok(data, req.requestId));
    } catch (err) {
      next(err);
    }
  };

  setGuestDriveFolder = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const concertId = req.params.concert_id;
      const body = (req.body ?? {}) as { guest_drive_folder_id?: unknown };
      const folder =
        typeof body.guest_drive_folder_id === "string" ? body.guest_drive_folder_id : "";
      const data = await this.service.setGuestDriveFolder(
        currentUserId(res),
        concertId,
        folder,
      );
      void invalidateConcertCache(concertId);
      res.json(ok(data, req.requestId));
    } catch (err) {
      next(err);
    }
  };

  createSeatZone = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const concertId = req.params.concert_id;
      const data = await this.service.createSeatZone(
        currentUserId(res),
        concertId,
        parseCreateOrganizerSeatZoneBody(req.body),
      );
      void invalidateConcertCache(concertId);
      res.status(201).json(ok(data, req.requestId));
    } catch (err) {
      next(err);
    }
  };

  createTicketType = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const concertId = req.params.concert_id;
      const data = await this.service.createTicketType(
        currentUserId(res),
        concertId,
        parseCreateOrganizerTicketTypeBody(req.body),
      );
      void invalidateConcertCache(concertId);
      res.status(201).json(ok(data, req.requestId));
    } catch (err) {
      next(err);
    }
  };

  createDeletionRequest = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const data = await this.service.createDeletionRequest(
        currentUserId(res),
        req.params.concert_id,
        parseCreateDeletionRequestBody(req.body),
      );
      res.status(201).json(ok(data, req.requestId));
    } catch (err) {
      next(err);
    }
  };

  getAnalytics = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.getAnalytics(
        currentUserId(res),
        req.params.concert_id,
      );
      res.json(ok(data, req.requestId));
    } catch (err) {
      next(err);
    }
  };

  listOrders = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = await this.service.listOrders(
        currentUserId(res),
        parseListQuery(req.query),
      );
      res.json(toCollection(page, req.requestId));
    } catch (err) {
      next(err);
    }
  };

  getTicketTypeInventory = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const data = await this.service.getTicketTypeInventory(
        currentUserId(res),
        req.params.ticket_type_id,
      );
      res.setHeader("Cache-Control", "no-store");
      res.json(ok(data, req.requestId));
    } catch (err) {
      next(err);
    }
  };

  listCheckerAccounts = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const page = await this.service.listCheckerAccounts(
        currentUserId(res),
        parseListQuery(req.query),
      );
      res.json(toCollection(page, req.requestId));
    } catch (err) {
      next(err);
    }
  };

  listGuests = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = await this.service.listGuests(
        currentUserId(res),
        req.params.concert_id,
        parseListQuery(req.query),
      );
      res.json(toCollection(page, req.requestId));
    } catch (err) {
      next(err);
    }
  };
}

function currentUserId(res: Response) {
  const userId = res.locals.auth?.user_id as string | undefined;
  if (!userId) {
    throw Errors.unauthorized();
  }
  return userId;
}

function imageExtension(contentType: string) {
  // Lấy subtype từ content-type: image/png→png, image/jpeg→jpg, image/svg+xml→svg...
  const sub = contentType.split("/")[1]?.split(/[;+]/)[0]?.trim();
  return !sub || sub === "jpeg" ? "jpg" : sub;
}

function toCollection<T extends { id: string }>(
  page: {
    items: T[];
    nextCursor: string | null;
    hasMore: boolean;
    limit: number;
  },
  requestId: string,
) {
  return collection(page.items, requestId, {
    next_cursor: page.nextCursor,
    has_more: page.hasMore,
    limit: page.limit,
  });
}

async function invalidateConcertCache(concertId: string): Promise<void> {
  await Promise.allSettled([
    cacheDelete(catalogCacheKeys.concert(concertId)),
    cacheDelete(catalogCacheKeys.metadata(concertId)),
    cacheDelete(catalogCacheKeys.seatMap(concertId)),
    cacheDelete(catalogCacheKeys.ticketTypes(concertId, false)),
    cacheDelete(catalogCacheKeys.ticketTypes(concertId, true)),
    cacheDelete(catalogCacheKeys.inventory(concertId)),
    cacheDeletePattern("catalog:list:*"),
  ]);
}
