/**
 * notifications.router.ts — Router stub cho Notification module.
 *
 * Sprint 1: không expose public endpoint. Module này chỉ được gọi nội bộ
 * từ các service khác (payment, tickets, check-in).
 *
 * Sprint 4: có thể thêm endpoint internal hoặc admin để xem notification status.
 */

import { Router } from "express";

export const notificationsRouter = Router();

// Sprint 4: thêm routes internal/admin nếu cần
// notificationsRouter.get("/", requireAuth, requireRole("ADMIN"), handleList);
