import type { NextFunction, Request, Response } from "express";
import { collection, ok } from "../../shared/http/response.js";
import { Errors } from "../../shared/http/problem-details.js";
import { OrganizerAdminService } from "./organizer-admin.service.js";
import { parseAdminListQuery, parseRejectBody } from "./organizer-admin.schema.js";

export class OrganizerAdminController {
  constructor(private readonly service = new OrganizerAdminService()) {}

  // ── Organizer requests ────────────────────────────────────────────────────
  listRequests = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = await this.service.listRequests(parseAdminListQuery(req.query));
      res.json(toCollection(page, req.requestId));
    } catch (err) {
      next(err);
    }
  };

  getRequest = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.getRequest(req.params.request_id);
      res.json(ok(data, req.requestId));
    } catch (err) {
      next(err);
    }
  };

  approveRequest = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.approveRequest(
        req.params.request_id,
        currentUserId(res),
      );
      res.status(201).json(ok(data, req.requestId));
    } catch (err) {
      next(err);
    }
  };

  rejectRequest = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.rejectRequest(
        req.params.request_id,
        currentUserId(res),
        parseRejectBody(req.body).review_note,
      );
      res.json(ok(data, req.requestId));
    } catch (err) {
      next(err);
    }
  };

  // ── Concert deletion requests ─────────────────────────────────────────────
  listDeletionRequests = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = await this.service.listDeletionRequests(parseAdminListQuery(req.query));
      res.json(toCollection(page, req.requestId));
    } catch (err) {
      next(err);
    }
  };

  approveDeletion = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.approveDeletion(
        req.params.request_id,
        currentUserId(res),
      );
      res.json(ok(data, req.requestId));
    } catch (err) {
      next(err);
    }
  };

  rejectDeletion = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.rejectDeletion(
        req.params.request_id,
        currentUserId(res),
        parseRejectBody(req.body).review_note,
      );
      res.json(ok(data, req.requestId));
    } catch (err) {
      next(err);
    }
  };

  // ── Checker accounts ──────────────────────────────────────────────────────
  listCheckerAccounts = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = await this.service.listCheckerAccounts(
        req.params.concert_id,
        parseAdminListQuery(req.query),
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
