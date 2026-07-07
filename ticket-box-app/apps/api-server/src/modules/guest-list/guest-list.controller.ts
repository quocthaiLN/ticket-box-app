import type { NextFunction, Request, Response } from "express";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@ticketbox/database";
import { collection, ok } from "../../shared/http/response.js";
import { parseImportErrorsQuery, parseGuestScanBody, parseGuestSearchQuery } from "./guest-list.schema.js";
import { GuestListService } from "./guest-list.service.js";
import { auditService } from "../audit/audit.service.js";

const service = new GuestListService();

// Admin chạy nhập thủ công cho 1 concert (enqueue job quét Drive ngoài lịch 0h).
export async function triggerGuestImport(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.triggerImport(req.params.concert_id);
    await auditService.record(
      {
        actor_user_id: res.locals.auth?.user_id ?? null,
        action: AUDIT_ACTIONS.GUEST_IMPORT_TRIGGERED,
        entity_type: AUDIT_ENTITY_TYPES.GUEST_IMPORT_JOB,
        entity_id: result.queue_job_id || null,
        metadata: {
          concert_id: result.concert_id,
          queue_job_id: result.queue_job_id,
          source: "manual_admin_trigger",
          status: result.status,
        },
        ip_address: req.ip,
        user_agent: req.get("user-agent") ?? null,
      },
      { bestEffort: true },
    );
    res.status(202).json(ok(result, req.requestId));
  } catch (err) {
    next(err);
  }
}

// Xem trạng thái 1 job import (số dòng thành công/lỗi).
export async function getGuestImportJob(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(ok(await service.getImportJob(req.params.job_id), req.requestId));
  } catch (err) {
    next(err);
  }
}

// Xem lỗi từng dòng của 1 job (phân trang cursor).
export async function getGuestImportJobErrors(req: Request, res: Response, next: NextFunction) {
  try {
    const { limit, cursor } = parseImportErrorsQuery(req.query as Record<string, unknown>);
    const page = await service.listImportErrors(req.params.job_id, limit, cursor);
    res.json(
      collection(page.items, req.requestId, {
        next_cursor: page.next_cursor,
        has_more: page.has_more,
        limit,
      }),
    );
  } catch (err) {
    next(err);
  }
}

// Danh sách job import của 1 concert (admin theo dõi sau khi trigger).
export async function listGuestImportJobs(req: Request, res: Response, next: NextFunction) {
  try {
    const { limit } = parseImportErrorsQuery(req.query as Record<string, unknown>);
    const jobs = await service.listImportJobs(req.params.concert_id, limit);
    res.json(collection(jobs, req.requestId, { next_cursor: null, has_more: false, limit }));
  } catch (err) {
    next(err);
  }
}

// Nhận request tìm guest và trả danh sách có phân trang đơn giản.
export async function searchGuests(req: Request, res: Response, next: NextFunction) {
  try {
    const query = parseGuestSearchQuery(withRouteConcertId(req.query, req.params.concert_id));
    const guests = await service.searchGuests(query);
    res.json(
      collection(guests, req.requestId, {
        next_cursor: null,
        has_more: false,
        limit: query.limit
      })
    );
  } catch (err) {
    next(err);
  }
}

// Nhận request check-in guest online tại cổng.
export async function scanGuest(req: Request, res: Response, next: NextFunction) {
  try {
    const body = parseGuestScanBody(req.body);
    res.setHeader("Cache-Control", "no-store");
    res.json(ok(await service.scanGuest(body), req.requestId));
  } catch (err) {
    next(err);
  }
}

// Ghép concert_id từ route vào body/query để dùng chung parser.
function withRouteConcertId(value: unknown, concertId?: string): Record<string, unknown> {
  const base = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return concertId ? { ...base, concert_id: concertId } : (base as Record<string, unknown>);
}
