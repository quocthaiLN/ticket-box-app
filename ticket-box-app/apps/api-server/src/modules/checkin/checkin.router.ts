import { Router } from "express";
import { requireRole } from "../../shared/guards/role.guard.js";
import { requireAuth } from "../../shared/middleware/auth.middleware.js";
import {
  createOfflineBatch,
  listGates,
  preloadForDevice,
  scanTicket,
  syncOfflineBatch
} from "./checkin.controller.js";

export const checkinRouter = Router();

const checkerOnly = [requireAuth, requireRole("CHECKER")];
const adminOnly = [requireAuth, requireRole("ADMIN")];

checkinRouter.post("/check-in/scan", ...checkerOnly, scanTicket);
checkinRouter.get("/check-in/preload", ...checkerOnly, preloadForDevice);
checkinRouter.post("/check-in/offline-sync", ...checkerOnly, syncOfflineBatch);
checkinRouter.post("/check-in/offline-batches", ...checkerOnly, createOfflineBatch);
checkinRouter.post("/check-in/offline-batches/:batch_id/items", ...checkerOnly, syncOfflineBatch);

checkinRouter.get("/admin/check-in/gates", ...adminOnly, listGates);
