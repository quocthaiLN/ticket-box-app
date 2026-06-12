import type { NextFunction, Request, Response } from "express";
import { collection, ok } from "../../shared/http/response.js";
import { parseGuestImportBody, parseGuestScanBody, parseGuestSearchQuery } from "./guest-list.schema.js";
import { GuestListService } from "./guest-list.service.js";

const service = new GuestListService();

// Nhận request tạo job import guest từ admin/organizer.
export async function importGuests(req: Request, res: Response, next: NextFunction) {
  try {
    const body = parseGuestImportBody(withRouteConcertId(req.body, req.params.concert_id));
    body.uploaded_by_user_id = res.locals.auth?.user_id;
    res.status(202).json(ok(await service.importGuests(body), req.requestId));
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
