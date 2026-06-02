import cors from "cors";
import express from "express";
import { catalogRouter } from "./modules/catalog/catalog.router.js";
import { errorMiddleware } from "./shared/middleware/error.middleware.js";
import { requestIdMiddleware } from "./shared/middleware/request-id.middleware.js";
import { ok } from "./shared/http/response.js";

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(requestIdMiddleware);

  app.get("/health", (_req, res) => {
    res.json({ status: "OK" });
  });

  app.get("/v1/health", (req, res) => {
    res.json(ok({ status: "OK" }, req.requestId));
  });

  app.use("/v1", catalogRouter);

  app.use(errorMiddleware);

  return app;
}
