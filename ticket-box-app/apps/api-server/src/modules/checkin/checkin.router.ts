import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import { requireRole } from "../../shared/guards/role.guard.js";
import { ok } from "../../shared/http/response.js";
import { requireAuth } from "../../shared/middleware/auth.middleware.js";
import {
  parseCreateDeviceBody,
  parseCreateGateBody,
  parseCreateGateZoneMappingBody,
  parseCheckinPreloadQuery,
  parseCheckinScanBody,
  parseListLimitQuery,
  parseOfflineBatchBody,
  parseOfflineSyncBody,
  parseReplaceGateZonesBody,
  parseUpdateDeviceBody,
  parseUpdateGateBody
} from "./checkin.schema.js";
import { CheckinService } from "./checkin.service.js";

export const checkinRouter = Router();

const service = new CheckinService();
const checkerOnly = [requireAuth, requireRole("CHECKER", "ADMIN")];
const organizerOnly = [requireAuth, requireRole("ORGANIZER", "ADMIN")];

// Nhận request scan vé online và trả kết quả check-in cho checker.
async function scanTicket(req: Request, res: Response, next: NextFunction) {
  try {
    const body = parseCheckinScanBody(req.body);
    res.setHeader("Cache-Control", "no-store");
    res.json(ok(await service.scanTicket(body), req.requestId));
  } catch (err) {
    next(err);
  }
}

// Nhận request preload/bootstrap dữ liệu cho thiết bị check-in.
async function preloadForDevice(req: Request, res: Response, next: NextFunction) {
  try {
    const query = parseCheckinPreloadQuery(req.query);
    res.setHeader("Cache-Control", "no-store");
    res.json(ok(await service.preloadForDevice(query), req.requestId));
  } catch (err) {
    next(err);
  }
}

// Nhận các item scan offline gửi lên để đồng bộ batch.
async function syncOfflineBatch(req: Request, res: Response, next: NextFunction) {
  try {
    const body = parseOfflineSyncBody(req.body, req.params.batch_id);
    res.setHeader("Cache-Control", "no-store");
    res.json(ok(await service.syncOfflineBatch(body), req.requestId));
  } catch (err) {
    next(err);
  }
}

// Tạo hoặc lấy lại batch sync offline theo batch token.
async function createOfflineBatch(req: Request, res: Response, next: NextFunction) {
  try {
    const body = parseOfflineBatchBody(req.body);
    res.setHeader("Cache-Control", "no-store");
    res.status(202).json(ok(await service.createOfflineBatch(body), req.requestId));
  } catch (err) {
    next(err);
  }
}

// Trả danh sách cổng check-in cho màn admin.
async function listGates(req: Request, res: Response, next: NextFunction) {
  try {
    const query = parseListLimitQuery({ ...req.query, concert_id: req.params.concert_id ?? req.query.concert_id });
    res.json(ok(await service.listGates(query), req.requestId));
  } catch (err) {
    next(err);
  }
}

// Trả chi tiết một cổng check-in.
async function getGate(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(ok(await service.getGate(req.params.gate_id), req.requestId));
  } catch (err) {
    next(err);
  }
}

// Tạo cổng check-in mới từ request admin.
async function createGate(req: Request, res: Response, next: NextFunction) {
  try {
    const body = parseCreateGateBody(req.body, req.params.concert_id);
    res.status(201).json(ok(await service.createGate(body), req.requestId));
  } catch (err) {
    next(err);
  }
}

// Cập nhật cổng check-in từ request admin.
async function updateGate(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(ok(await service.updateGate(req.params.gate_id, parseUpdateGateBody(req.body)), req.requestId));
  } catch (err) {
    next(err);
  }
}

// Vô hiệu hoá cổng check-in từ request admin.
async function deleteGate(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(ok(await service.deleteGate(req.params.gate_id), req.requestId));
  } catch (err) {
    next(err);
  }
}

// Trả danh sách thiết bị check-in cho màn admin.
async function listDevices(req: Request, res: Response, next: NextFunction) {
  try {
    const query = parseListLimitQuery(req.query);
    res.json(ok(await service.listDevices(query), req.requestId));
  } catch (err) {
    next(err);
  }
}

// Đăng ký thiết bị check-in mới từ request admin.
async function createDevice(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(201).json(ok(await service.createDevice(parseCreateDeviceBody(req.body)), req.requestId));
  } catch (err) {
    next(err);
  }
}

// Cập nhật thiết bị check-in từ request admin.
async function updateDevice(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(ok(await service.updateDevice(req.params.device_id, parseUpdateDeviceBody(req.body)), req.requestId));
  } catch (err) {
    next(err);
  }
}

// Thu hồi thiết bị check-in từ request admin.
async function deleteDevice(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(ok(await service.deleteDevice(req.params.device_id), req.requestId));
  } catch (err) {
    next(err);
  }
}

// Trả danh sách mapping giữa cổng và khu vé.
async function listGateZoneMappings(req: Request, res: Response, next: NextFunction) {
  try {
    const query = parseListLimitQuery(req.query);
    res.json(ok(await service.listGateZoneMappings(query), req.requestId));
  } catch (err) {
    next(err);
  }
}

// Tạo mapping giữa một cổng và một khu vé.
async function createGateZoneMapping(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(201).json(ok(await service.createGateZoneMapping(parseCreateGateZoneMappingBody(req.body)), req.requestId));
  } catch (err) {
    next(err);
  }
}

// Thay toàn bộ danh sách khu vé được phép của một cổng.
async function replaceGateZones(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(ok(await service.replaceGateZones(req.params.gate_id, parseReplaceGateZonesBody(req.body)), req.requestId));
  } catch (err) {
    next(err);
  }
}

// Xoá mapping cổng-khu vé theo id trên route.
async function deleteGateZoneMapping(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(ok(await service.deleteGateZoneMapping(req.params.mapping_id), req.requestId));
  } catch (err) {
    next(err);
  }
}

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
