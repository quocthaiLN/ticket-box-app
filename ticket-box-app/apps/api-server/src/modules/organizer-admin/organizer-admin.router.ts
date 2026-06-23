import { Router } from "express";
import { requireRole } from "../../shared/guards/role.guard.js";
import { requireAuth } from "../../shared/middleware/auth.middleware.js";
import { OrganizerAdminController } from "./organizer-admin.controller.js";

export const organizerAdminRouter = Router();

const controller = new OrganizerAdminController();
const adminOnly = [requireAuth, requireRole("ADMIN")] as const;

// Duyệt hồ sơ tổ chức concert
organizerAdminRouter.get("/admin/organizer-requests", ...adminOnly, controller.listRequests);
organizerAdminRouter.get("/admin/organizer-requests/:request_id", ...adminOnly, controller.getRequest);
organizerAdminRouter.post("/admin/organizer-requests/:request_id/approve", ...adminOnly, controller.approveRequest);
organizerAdminRouter.post("/admin/organizer-requests/:request_id/reject", ...adminOnly, controller.rejectRequest);

// Duyệt yêu cầu xóa concert
organizerAdminRouter.get("/admin/concert-deletion-requests", ...adminOnly, controller.listDeletionRequests);
organizerAdminRouter.post("/admin/concert-deletion-requests/:request_id/approve", ...adminOnly, controller.approveDeletion);
organizerAdminRouter.post("/admin/concert-deletion-requests/:request_id/reject", ...adminOnly, controller.rejectDeletion);

// Danh sách checker account của concert (không lộ password)
organizerAdminRouter.get("/admin/concerts/:concert_id/checker-accounts", ...adminOnly, controller.listCheckerAccounts);
