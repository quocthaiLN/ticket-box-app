import cors from "cors";
import express from "express";
import cookieParser from "cookie-parser";
import { authRouter } from "./modules/auth/auth.router.js";
import { catalogRouter } from "./modules/catalog/catalog.router.js";
import { checkinRouter } from "./modules/checkin/checkin.router.js";
import { guestListRouter } from "./modules/guest-list/guest-list.router.js";
import orderRouter from "./modules/orders/order.router.js";
import paymentRouter from "./modules/payments/payment.router.js";
import ticketRouter from "./modules/tickets/ticket.router.js";
import { notificationsRouter } from "./modules/notifications/notifications.router.js";
import { errorMiddleware } from "./shared/middleware/error.middleware.js";
import { requestIdMiddleware } from "./shared/middleware/request-id.middleware.js";
import {
  orderRateLimit,
  webhookRateLimit,
  publicReadRateLimit,
} from "./shared/middleware/rate-limit.middleware.js";
import { ok } from "./shared/http/response.js";
import morgan from "morgan";
import helmet from "helmet";

export function createApp() {
  const app = express();

  app.use(
    cors({
      credentials: true,
      origin(origin, callback) {
        if (!origin || /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) {
          callback(null, true);
          return;
        }
        callback(null, false);
      },
    }),
  );
  app.use(express.json());
  app.use(cookieParser());
  app.use(requestIdMiddleware);
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

  // ── Check-in ───────────────────────────────────────────────────────────────
  app.use("/v1", checkinRouter);

  // ── Guest list ─────────────────────────────────────────────────────────────
  app.use("/v1", guestListRouter);

  // ── Orders — strict rate limit chống scalper ───────────────────────────────
  app.use("/v1/orders", orderRateLimit);
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
