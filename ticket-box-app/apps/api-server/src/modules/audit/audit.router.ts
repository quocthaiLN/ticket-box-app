import { Router } from "express";
import { requireRole } from "../../shared/guards/role.guard.js";
import { collection } from "../../shared/http/response.js";
import { Errors } from "../../shared/http/problem-details.js";
import { requireAuth } from "../../shared/middleware/auth.middleware.js";
import { AuditListQuerySchema } from "./audit.schema.js";
import { auditService } from "./audit.service.js";

export const auditRouter = Router();

const adminOnly = [requireAuth, requireRole("ADMIN")] as const;

auditRouter.get("/admin/audit-logs", ...adminOnly, async (req, res, next) => {
  try {
    const parsed = AuditListQuerySchema.safeParse(req.query);
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

    const { items, nextCursor } = await auditService.list(parsed.data);

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
});
