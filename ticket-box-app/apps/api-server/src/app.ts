import { env } from "@ticketbox/config";
import cors from "cors";
import express from "express";
import cookieParser from "cookie-parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { authRouter } from "./modules/auth/auth.router.js";
import { catalogRouter } from "./modules/catalog/catalog.router.js";
import { checkinRouter } from "./modules/checkin/checkin.router.js";
import { guestListRouter } from "./modules/guest-list/guest-list.router.js";
import orderRouter from "./modules/orders/order.router.js";
import { organizerRouter } from "./modules/organizer/organizer.router.js";
import { organizerAdminRouter } from "./modules/organizer-admin/organizer-admin.router.js";
import paymentRouter from "./modules/payments/payment.router.js";
import ticketRouter from "./modules/tickets/ticket.router.js";
import { notificationsRouter } from "./modules/notifications/notifications.router.js";
import { auditRouter } from "./modules/audit/audit.router.js";
import { errorMiddleware } from "./shared/middleware/error.middleware.js";
import { requestIdMiddleware } from "./shared/middleware/request-id.middleware.js";
import {
  orderIpRateLimit,
  webhookRateLimit,
  publicReadRateLimit,
} from "./shared/middleware/rate-limit.middleware.js";
import { ok } from "./shared/http/response.js";
import morgan from "morgan";
import helmet from "helmet";

export function createApp() {
  const app = express();
  const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public");

  // Origin của frontend production (Vercel) lấy từ WEB_URL để redirect/CORS khớp nhau.
  const webOrigin = env.web.url.replace(/\/+$/, "");
  app.use(
    cors({
      credentials: true,
      exposedHeaders: ["Retry-After"],
      origin(origin, callback) {
        if (
          !origin ||
          origin === webOrigin ||
          /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin) ||
          /^https:\/\/[a-z0-9-]+\.ngrok-free\.(dev|app)$/.test(origin) ||
          /^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin)
        ) {
          callback(null, true);
          return;
        }
        callback(null, false);
      },
    }),
  );
  app.use("/uploads", express.static(path.join(publicDir, "uploads")));
  app.use(express.json());
  app.use(cookieParser());
  app.use(requestIdMiddleware);
  app.use((_req, res, next) => {
    res.setHeader("X-TicketBox-Instance", env.server.instanceId);
    next();
  });
  app.use(helmet());
  app.use(morgan("dev"));

  // ── Health ──────────────────────────────────────────────────────────────────
  app.get("/health", (_req, res) => {
    res.json({ status: "OK" });
  });

  app.get("/v1/health", (req, res) => {
    res.json(ok({ status: "OK" }, req.requestId));
  });

  // ── Auth ────────────────────────────────────────────────────────────────────
  app.use("/v1/auth", authRouter);

  // ── Catalog (public reads) — rate limited ───────────────────────────────────
  app.use("/v1/concerts", publicReadRateLimit);
  app.use("/v1", catalogRouter);

  // ── Notifications (admin + internal) ───────────────────────────────────────
  app.use("/v1", notificationsRouter);
  app.use("/v1", auditRouter);

  // ── Organizer workspace + Admin duyệt hồ sơ ────────────────────────────────
  app.use("/v1", organizerRouter);
  app.use("/v1", organizerAdminRouter);

  // ── Check-in ───────────────────────────────────────────────────────────────
  app.use("/v1", checkinRouter);

  // ── Guest list ─────────────────────────────────────────────────────────────
  app.use("/v1", guestListRouter);

  // ── Orders — tầng IP trước auth; tầng user sau auth nằm trong router ───────
  app.post("/v1/orders", orderIpRateLimit);
  app.use("/v1", orderRouter);

  // ── Payments — webhook rate limit ──────────────────────────────────────────
  app.use("/v1/payments/webhook", webhookRateLimit);
  app.use("/v1", paymentRouter);

  // ── Tickets ────────────────────────────────────────────────────────────────
  app.use("/v1", ticketRouter);

  // ── Error handler (must be last) ───────────────────────────────────────────
  app.use(errorMiddleware);

  return app;
}
