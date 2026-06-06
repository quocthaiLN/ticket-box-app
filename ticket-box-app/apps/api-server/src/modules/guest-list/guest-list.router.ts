import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import { requireRole } from "../../shared/guards/role.guard.js";
import { collection, ok } from "../../shared/http/response.js";
import { requireAuth } from "../../shared/middleware/auth.middleware.js";
import { parseGuestImportBody, parseGuestScanBody, parseGuestSearchQuery } from "./guest-list.schema.js";
import { GuestListService } from "./guest-list.service.js";

export const guestListRouter = Router();

const service = new GuestListService();
const organizerOnly = [requireAuth, requireRole("ORGANIZER", "ADMIN")];
const checkerOnly = [requireAuth, requireRole("CHECKER", "ADMIN")];

// Nhận request tạo job import guest từ admin/organizer.
async function importGuests(req: Request, res: Response, next: NextFunction) {
  try {
    const body = parseGuestImportBody(withRouteConcertId(req.body, req.params.concert_id));
    res.status(202).json(ok(await service.importGuests(body), req.requestId));
  } catch (err) {
    next(err);
  }
}

// Nhận request tìm guest và trả danh sách có phân trang đơn giản.
async function searchGuests(req: Request, res: Response, next: NextFunction) {
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
async function scanGuest(req: Request, res: Response, next: NextFunction) {
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

guestListRouter.post("/guest-list/import", ...organizerOnly, importGuests);
guestListRouter.post("/admin/concerts/:concert_id/guest-import-jobs", ...organizerOnly, importGuests);

guestListRouter.get("/guest-list/search", ...checkerOnly, searchGuests);
guestListRouter.get("/check-in/guests/search", ...checkerOnly, searchGuests);
guestListRouter.get("/admin/concerts/:concert_id/guests", ...organizerOnly, searchGuests);

guestListRouter.post("/guest-list/scan", ...checkerOnly, scanGuest);
guestListRouter.post("/check-in/guests/scans", ...checkerOnly, scanGuest);
