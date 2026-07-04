import type { NextFunction, Request, Response } from "express";
import { ok } from "../../shared/http/response.js";
import {
  parseCheckinPreloadQuery,
  parseCheckinScanBody,
  parseCreateDeviceBody,
  parseCreateGateBody,
  parseCreateGateZoneMappingBody,
  parseListLimitQuery,
  parseOfflineBatchBody,
  parseOfflineSyncBody,
  parseReplaceGateZonesBody,
  parseUpdateDeviceBody,
  parseUpdateGateBody
} from "./checkin.schema.js";
import { CheckinService } from "./checkin.service.js";

const service = new CheckinService();

// Nhận request scan vé online và trả kết quả check-in cho checker.
export async function scanTicket(req: Request, res: Response, next: NextFunction) {
  try {
    const body = parseCheckinScanBody(req.body);
    res.setHeader("Cache-Control", "no-store");
    res.json(ok(await service.scanTicket(body), req.requestId));
  } catch (err) {
    next(err);
  }
}

// Nhận request preload/bootstrap dữ liệu cho thiết bị check-in.
export async function preloadForDevice(req: Request, res: Response, next: NextFunction) {
  try {
    const query = parseCheckinPreloadQuery(req.query);
    res.setHeader("Cache-Control", "no-store");
    res.json(ok(await service.preloadForDevice(query), req.requestId));
  } catch (err) {
    next(err);
  }
}

// Nhận các item scan offline gửi lên để đồng bộ batch.
export async function syncOfflineBatch(req: Request, res: Response, next: NextFunction) {
  try {
    const body = parseOfflineSyncBody(req.body, req.params.batch_id);
    res.setHeader("Cache-Control", "no-store");
    res.json(ok(await service.syncOfflineBatch(body), req.requestId));
  } catch (err) {
    next(err);
  }
}

// Tạo hoặc lấy lại batch sync offline theo batch token.
export async function createOfflineBatch(req: Request, res: Response, next: NextFunction) {
  try {
    const body = parseOfflineBatchBody(req.body);
    res.setHeader("Cache-Control", "no-store");
    res.status(202).json(ok(await service.createOfflineBatch(body), req.requestId));
  } catch (err) {
    next(err);
  }
}

// Trả danh sách cổng check-in cho màn admin.
export async function listGates(req: Request, res: Response, next: NextFunction) {
  try {
    const query = parseListLimitQuery({ ...req.query, concert_id: req.params.concert_id ?? req.query.concert_id });
    res.json(ok(await service.listGates(query), req.requestId));
  } catch (err) {
    next(err);
  }
}

// Trả chi tiết một cổng check-in.
export async function getGate(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(ok(await service.getGate(req.params.gate_id), req.requestId));
  } catch (err) {
    next(err);
  }
}

// Tạo cổng check-in mới từ request admin.
export async function createGate(req: Request, res: Response, next: NextFunction) {
  try {
    const body = parseCreateGateBody(req.body, req.params.concert_id);
    res.status(201).json(ok(await service.createGate(body), req.requestId));
  } catch (err) {
    next(err);
  }
}

// Cập nhật cổng check-in từ request admin.
export async function updateGate(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(ok(await service.updateGate(req.params.gate_id, parseUpdateGateBody(req.body)), req.requestId));
  } catch (err) {
    next(err);
  }
}

// Vô hiệu hoá cổng check-in từ request admin.
export async function deleteGate(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(ok(await service.deleteGate(req.params.gate_id), req.requestId));
  } catch (err) {
    next(err);
  }
}

// Trả danh sách thiết bị check-in cho màn admin.
export async function listDevices(req: Request, res: Response, next: NextFunction) {
  try {
    const query = parseListLimitQuery(req.query);
    res.json(ok(await service.listDevices(query), req.requestId));
  } catch (err) {
    next(err);
  }
}

// Đăng ký thiết bị check-in mới từ request admin.
export async function createDevice(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(201).json(ok(await service.createDevice(parseCreateDeviceBody(req.body)), req.requestId));
  } catch (err) {
    next(err);
  }
}

// Cập nhật thiết bị check-in từ request admin.
export async function updateDevice(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(ok(await service.updateDevice(req.params.device_id, parseUpdateDeviceBody(req.body)), req.requestId));
  } catch (err) {
    next(err);
  }
}

// Thu hồi thiết bị check-in từ request admin.
export async function deleteDevice(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(ok(await service.deleteDevice(req.params.device_id), req.requestId));
  } catch (err) {
    next(err);
  }
}

// Trả danh sách mapping giữa cổng và khu vé.
export async function listGateZoneMappings(req: Request, res: Response, next: NextFunction) {
  try {
    const query = parseListLimitQuery(req.query);
    res.json(ok(await service.listGateZoneMappings(query), req.requestId));
  } catch (err) {
    next(err);
  }
}

// Tạo mapping giữa một cổng và một khu vé.
export async function createGateZoneMapping(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(201).json(ok(await service.createGateZoneMapping(parseCreateGateZoneMappingBody(req.body)), req.requestId));
  } catch (err) {
    next(err);
  }
}

// Thay toàn bộ danh sách khu vé được phép của một cổng.
export async function replaceGateZones(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(ok(await service.replaceGateZones(req.params.gate_id, parseReplaceGateZonesBody(req.body)), req.requestId));
  } catch (err) {
    next(err);
  }
}

// Xoá mapping cổng-khu vé theo id trên route.
export async function deleteGateZoneMapping(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(ok(await service.deleteGateZoneMapping(req.params.mapping_id), req.requestId));
  } catch (err) {
    next(err);
  }
}
