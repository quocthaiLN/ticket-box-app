import cors from "cors";
import express from "express";
import cookieParser from "cookie-parser";
import { authRouter } from "./modules/auth/auth.router.js";
import { catalogRouter } from "./modules/catalog/catalog.router.js";
import { checkinRouter } from "./modules/checkin/checkin.router.js";
import { guestListRouter } from "./modules/guest-list/guest-list.router.js";
import inventoryRouter from "./modules/inventory/inventory.router.js";
import orderRouter from "./modules/orders/order.router.js";
import paymentRouter from "./modules/payments/payment.router.js";
import ticketRouter from "./modules/tickets/ticket.router.js";
import { errorMiddleware } from "./shared/middleware/error.middleware.js";
import { requestIdMiddleware } from "./shared/middleware/request-id.middleware.js";
import { ok } from "./shared/http/response.js";

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(cookieParser());
  app.use(requestIdMiddleware);

  app.get("/health", (_req, res) => {
    res.json({ status: "OK" });
  });

  app.get("/v1/health", (req, res) => {
    res.json(ok({ status: "OK" }, req.requestId));
  });

  app.use("/v1/auth", authRouter);
  app.use("/v1", catalogRouter);
  app.use("/v1", checkinRouter);
  app.use("/v1", guestListRouter);
  app.use("/v1", inventoryRouter);
  app.use("/v1", orderRouter);
  app.use("/v1", paymentRouter);
  app.use("/v1", ticketRouter);

  app.use(errorMiddleware);

  return app;
}
