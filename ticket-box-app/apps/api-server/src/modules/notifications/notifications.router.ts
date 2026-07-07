import { Router } from "express";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@ticketbox/database";
import { requireAuth } from "../../shared/middleware/auth.middleware.js";
import { requireRole } from "../../shared/guards/role.guard.js";
import { collection, ok } from "../../shared/http/response.js";
import { Errors } from "../../shared/http/problem-details.js";
import { auditService } from "../audit/audit.service.js";
import { notificationsService } from "./notifications.service.js";
import {
  AdminNotificationsQuerySchema,
  InternalEnqueueSchema,
} from "./notifications.schema.js";

export const notificationsRouter = Router();

const adminOnly = [requireAuth, requireRole("ADMIN")] as const;

// GET /admin/notifications — list với filters
notificationsRouter.get(
  "/admin/notifications",
  ...adminOnly,
  async (req, res, next) => {
    try {
      const parsed = AdminNotificationsQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        next(
          Errors.validationError(
            "Invalid query parameters",
            parsed.error.errors.map((e) => ({
              field: e.path.join("."),
              message: e.message,
            })),
          ),
        );
        return;
      }

      const { items, nextCursor } = await notificationsService.list(
        parsed.data,
      );

      res.json(
        collection(items, req.requestId, {
          next_cursor: nextCursor,
          has_more: nextCursor !== null,
          limit: parsed.data.limit,
        }),
      );
    } catch (err) {
      next(err);
    }
  },
);

// GET /admin/notifications/:id — detail
notificationsRouter.get(
  "/admin/notifications/:notification_id",
  ...adminOnly,
  async (req, res, next) => {
    try {
      const notification = await notificationsService.getById(
        req.params.notification_id,
      );
      if (!notification) {
        next(Errors.notificationNotFound(req.params.notification_id));
        return;
      }
      res.json(ok(notification, req.requestId));
    } catch (err) {
      next(err);
    }
  },
);

// POST /admin/notifications/:id/retry — retry FAILED notification
notificationsRouter.post(
  "/admin/notifications/:notification_id/retry",
  ...adminOnly,
  async (req, res, next) => {
    try {
      const existing = await notificationsService.getById(
        req.params.notification_id,
      );
      if (!existing) {
        next(Errors.notificationNotFound(req.params.notification_id));
        return;
      }

      if (existing.status !== "FAILED") {
        next(Errors.notificationNotRetryable(existing.status));
        return;
      }

      const updated = await notificationsService.retry(
        req.params.notification_id,
      );
      if (updated) {
        await auditService.record(
          {
            actor_user_id: res.locals.auth?.user_id ?? null,
            action: AUDIT_ACTIONS.RETRY_NOTIFICATION,
            entity_type: AUDIT_ENTITY_TYPES.NOTIFICATION,
            entity_id: updated.id,
            metadata: {
              previous_status: existing.status,
              new_status: updated.status,
              attempts: updated.attempts,
              channel: updated.channel,
              type: updated.type,
            },
            ip_address: req.ip,
            user_agent: req.get("user-agent") ?? null,
          },
          { bestEffort: true },
        );
      }
      res.status(202).json(ok(updated, req.requestId));
    } catch (err) {
      next(err);
    }
  },
);

// POST /internal/notifications/enqueue — internal endpoint for other modules
notificationsRouter.post(
  "/internal/notifications/enqueue",
  requireAuth,
  requireRole("ADMIN"),
  async (req, res, next) => {
    try {
      const parsed = InternalEnqueueSchema.safeParse(req.body);
      if (!parsed.success) {
        next(
          Errors.validationError(
            "Invalid notification payload",
            parsed.error.errors.map((e) => ({
              field: e.path.join("."),
              message: e.message,
            })),
          ),
        );
        return;
      }

      const notification = await notificationsService.enqueue({
        user_id: parsed.data.user_id,
        concert_id: parsed.data.concert_id,
        ticket_id: parsed.data.ticket_id,
        channel: parsed.data.channel,
        type: parsed.data.type,
        payload: parsed.data.payload,
        subject: parsed.data.subject,
        body: parsed.data.body,
      });

      res.status(202).json(ok(notification, req.requestId));
    } catch (err) {
      next(err);
    }
  },
);
