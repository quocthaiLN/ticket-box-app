import { Router } from "express";
import { requireRole } from "../../shared/guards/role.guard.js";
import { requireAuth } from "../../shared/middleware/auth.middleware.js";
import {
  getGuestImportJob,
  getGuestImportJobErrors,
  scanGuest,
  searchGuests,
  triggerGuestImport,
} from "./guest-list.controller.js";

export const guestListRouter = Router();

const adminOnly = [requireAuth, requireRole("ADMIN")];
const organizerOrAdmin = [requireAuth, requireRole("ORGANIZER", "ADMIN")];
const checkerOnly = [requireAuth, requireRole("CHECKER", "ADMIN")];

// Nhập khách mời VIP chạy tự động lúc 0h (giờ VN) từ Google Drive.
// Endpoint dưới để admin chạy nhập thủ công cho 1 concert (test / chạy lại ngoài lịch).
guestListRouter.post("/admin/concerts/:concert_id/guest-import-jobs", ...adminOnly, triggerGuestImport);
guestListRouter.get("/admin/guest-import-jobs/:job_id", ...adminOnly, getGuestImportJob);
guestListRouter.get("/admin/guest-import-jobs/:job_id/errors", ...adminOnly, getGuestImportJobErrors);

// Tra cứu guest: admin/organizer xem danh sách; checker tra tại cổng VIP.
guestListRouter.get("/admin/concerts/:concert_id/guests", ...organizerOrAdmin, searchGuests);
guestListRouter.get("/check-in/guests/search", ...checkerOnly, searchGuests);

// Check-in guest tại cổng VIP.
guestListRouter.post("/check-in/guests/scans", ...checkerOnly, scanGuest);
