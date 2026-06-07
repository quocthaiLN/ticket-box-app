import { Router } from "express";
import { requireRole } from "../../shared/guards/role.guard.js";
import { requireAuth } from "../../shared/middleware/auth.middleware.js";
import { importGuests, scanGuest, searchGuests } from "./guest-list.controller.js";

export const guestListRouter = Router();

const organizerOnly = [requireAuth, requireRole("ORGANIZER", "ADMIN")];
const checkerOnly = [requireAuth, requireRole("CHECKER", "ADMIN")];

guestListRouter.post("/guest-list/import", ...organizerOnly, importGuests);
guestListRouter.post("/admin/concerts/:concert_id/guest-import-jobs", ...organizerOnly, importGuests);

guestListRouter.get("/guest-list/search", ...checkerOnly, searchGuests);
guestListRouter.get("/check-in/guests/search", ...checkerOnly, searchGuests);
guestListRouter.get("/admin/concerts/:concert_id/guests", ...organizerOnly, searchGuests);

guestListRouter.post("/guest-list/scan", ...checkerOnly, scanGuest);
guestListRouter.post("/check-in/guests/scans", ...checkerOnly, scanGuest);
