import { Router } from "express";
import { requireRole } from "../../shared/guards/role.guard.js";
import { requireAuth } from "../../shared/middleware/auth.middleware.js";
import {
  createDevice,
  createGate,
  createGateZoneMapping,
  createOfflineBatch,
  deleteDevice,
  deleteGate,
  deleteGateZoneMapping,
  getGate,
  listDevices,
  listGates,
  listGateZoneMappings,
  preloadForDevice,
  replaceGateZones,
  scanTicket,
  syncOfflineBatch,
  updateDevice,
  updateGate
} from "./checkin.controller.js";

export const checkinRouter = Router();

const checkerOnly = [requireAuth, requireRole("CHECKER", "ADMIN")];
const organizerOnly = [requireAuth, requireRole("ORGANIZER", "ADMIN")];

checkinRouter.post("/check-in/scan", ...checkerOnly, scanTicket);
checkinRouter.post("/check-in/scans", ...checkerOnly, scanTicket);
checkinRouter.get("/check-in/preload", ...checkerOnly, preloadForDevice);
checkinRouter.get("/check-in/bootstrap", ...checkerOnly, preloadForDevice);
// Alias preload theo device_id trên route, sau đó dùng chung handler preload.
checkinRouter.get("/check-in/devices/:device_id/preload", ...checkerOnly, (req, res, next) => {
  req.query.device_id = req.params.device_id;
  void preloadForDevice(req, res, next);
});
// Alias preload theo gate_id trên route, sau đó dùng chung handler preload.
checkinRouter.get("/check-in/gates/:gate_id/preload", ...checkerOnly, (req, res, next) => {
  req.query.gate_id = req.params.gate_id;
  void preloadForDevice(req, res, next);
});
checkinRouter.post("/check-in/offline-sync", ...checkerOnly, syncOfflineBatch);
checkinRouter.post("/check-in/offline-batches", ...checkerOnly, createOfflineBatch);
checkinRouter.post("/check-in/offline-batches/:batch_id/items", ...checkerOnly, syncOfflineBatch);

checkinRouter.get("/admin/concerts/:concert_id/check-in/gates", ...organizerOnly, listGates);
checkinRouter.post("/admin/concerts/:concert_id/check-in/gates", ...organizerOnly, createGate);
checkinRouter.post("/admin/check-in/gates", ...organizerOnly, createGate);
checkinRouter.get("/admin/check-in/gates", ...organizerOnly, listGates);
checkinRouter.get("/admin/check-in/gates/:gate_id", ...organizerOnly, getGate);
checkinRouter.patch("/admin/check-in/gates/:gate_id", ...organizerOnly, updateGate);
checkinRouter.delete("/admin/check-in/gates/:gate_id", ...organizerOnly, deleteGate);
checkinRouter.put("/admin/check-in/gates/:gate_id/zones", ...organizerOnly, replaceGateZones);

checkinRouter.post("/admin/check-in/devices", ...organizerOnly, createDevice);
checkinRouter.get("/admin/check-in/devices", ...organizerOnly, listDevices);
checkinRouter.patch("/admin/check-in/devices/:device_id", ...organizerOnly, updateDevice);
checkinRouter.delete("/admin/check-in/devices/:device_id", ...organizerOnly, deleteDevice);

checkinRouter.post("/admin/check-in/gate-zone-mappings", ...organizerOnly, createGateZoneMapping);
checkinRouter.get("/admin/check-in/gate-zone-mappings", ...organizerOnly, listGateZoneMappings);
checkinRouter.delete("/admin/check-in/gate-zone-mappings/:mapping_id", ...organizerOnly, deleteGateZoneMapping);
