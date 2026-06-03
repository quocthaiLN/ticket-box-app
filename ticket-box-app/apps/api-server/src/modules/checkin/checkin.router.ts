import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import { requireRole } from "../../shared/guards/role.guard.js";
import { ok } from "../../shared/http/response.js";
import { requireAuth } from "../../shared/middleware/auth.middleware.js";
import {
  parseCheckinPreloadQuery,
  parseCheckinScanBody,
  parseOfflineBatchBody,
  parseOfflineSyncBody
} from "./checkin.schema.js";
import { CheckinService } from "./checkin.service.js";

export const checkinRouter = Router();

const service = new CheckinService();
const checkerOnly = [requireAuth, requireRole("CHECKER", "ADMIN")];

async function scanTicket(req: Request, res: Response, next: NextFunction) {
  try {
    const body = parseCheckinScanBody(req.body);
    res.setHeader("Cache-Control", "no-store");
    res.json(ok(await service.scanTicket(body), req.requestId));
  } catch (err) {
    next(err);
  }
}

async function preloadForDevice(req: Request, res: Response, next: NextFunction) {
  try {
    const query = parseCheckinPreloadQuery(req.query);
    res.setHeader("Cache-Control", "no-store");
    res.json(ok(await service.preloadForDevice(query), req.requestId));
  } catch (err) {
    next(err);
  }
}

async function syncOfflineBatch(req: Request, res: Response, next: NextFunction) {
  try {
    const body = parseOfflineSyncBody(req.body, req.params.batch_id);
    res.setHeader("Cache-Control", "no-store");
    res.json(ok(await service.syncOfflineBatch(body), req.requestId));
  } catch (err) {
    next(err);
  }
}

async function createOfflineBatch(req: Request, res: Response, next: NextFunction) {
  try {
    const body = parseOfflineBatchBody(req.body);
    res.setHeader("Cache-Control", "no-store");
    res.status(202).json(ok(await service.createOfflineBatch(body), req.requestId));
  } catch (err) {
    next(err);
  }
}

checkinRouter.post("/check-in/scan", ...checkerOnly, scanTicket);
checkinRouter.post("/check-in/scans", ...checkerOnly, scanTicket);
checkinRouter.get("/check-in/preload", ...checkerOnly, preloadForDevice);
checkinRouter.post("/check-in/offline-sync", ...checkerOnly, syncOfflineBatch);
checkinRouter.post("/check-in/offline-batches", ...checkerOnly, createOfflineBatch);
checkinRouter.post("/check-in/offline-batches/:batch_id/items", ...checkerOnly, syncOfflineBatch);
