import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { cacheDelete, cacheDeletePattern } from "@ticketbox/redis";
import { createPressKitUploadUrl } from "@ticketbox/storage";
import { collection, ok } from "../../shared/http/response.js";
import { Errors } from "../../shared/http/problem-details.js";
import { catalogCacheKeys } from "../catalog/catalog.cache.js";
import {
  parseCreateDeletionRequestBody,
  parseCreateOrganizerRequestBody,
  parseListQuery,
  parseUpdateOrganizerConcertBody,
} from "./organizer.schema.js";
import { OrganizerService } from "./organizer.service.js";

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
      const page = await this.service.listRequests(currentUserId(res), parseListQuery(req.query));
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

  // Cấp signed upload URL để BTC đẩy file PDF press kit thẳng lên Supabase.
  createPressKitUpload = async (req: Request, res: Response, next: NextFunction) => {
    try {
      currentUserId(res); // chỉ cần đảm bảo đã đăng nhập; guard ORGANIZER ở router
      const data = await createPressKitUploadUrl(`${randomUUID()}.pdf`);
      res.json(ok(data, req.requestId));
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
      const page = await this.service.listConcerts(currentUserId(res), parseListQuery(req.query));
      res.json(toCollection(page, req.requestId));
    } catch (err) {
      next(err);
    }
  };

  updateDraftConcert = async (req: Request, res: Response, next: NextFunction) => {
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

  createDeletionRequest = async (req: Request, res: Response, next: NextFunction) => {
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
      const page = await this.service.listOrders(currentUserId(res), parseListQuery(req.query));
      res.json(toCollection(page, req.requestId));
    } catch (err) {
      next(err);
    }
  };

  getTicketTypeInventory = async (req: Request, res: Response, next: NextFunction) => {
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

  listCheckerAccounts = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = await this.service.listCheckerAccounts(currentUserId(res), parseListQuery(req.query));
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

function toCollection<T extends { id: string }>(
  page: { items: T[]; nextCursor: string | null; hasMore: boolean; limit: number },
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
