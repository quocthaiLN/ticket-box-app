import { CheckinRepository } from "./checkin.repository.js";
import type {
  CheckinPreloadQuery,
  CheckinScanRequest,
  CreateDeviceRequest,
  CreateGateRequest,
  CreateGateZoneMappingRequest,
  OfflineBatchRequest,
  OfflineSyncRequest,
  ReplaceGateZonesRequest,
  UpdateDeviceRequest,
  UpdateGateRequest
} from "./checkin.types.js";

export class CheckinService {
  constructor(private readonly repository = new CheckinRepository()) {}

  // Gọi repository để xử lý quét vé online.
  scanTicket(input: CheckinScanRequest) {
    return this.repository.recordOnlineScan(input);
  }

  // Gọi repository để lấy dữ liệu preload/bootstrap cho thiết bị.
  preloadForDevice(query: CheckinPreloadQuery) {
    return this.repository.getPreloadSnapshot(query);
  }

  // Gọi repository để xử lý batch sync offline dạng scaffold.
  syncOfflineBatch(input: OfflineSyncRequest) {
    return this.repository.recordOfflineSyncBatch(input);
  }

  // Gọi repository để tạo batch offline idempotent.
  createOfflineBatch(input: OfflineBatchRequest) {
    return this.repository.createOfflineBatch(input);
  }

  // Gọi repository để lấy danh sách cổng check-in.
  listGates(query: { concert_id?: string; gate_id?: string; limit: number }) {
    return this.repository.listGates(query);
  }

  // Gọi repository để lấy chi tiết một cổng check-in.
  getGate(gateId: string) {
    return this.repository.getGate(gateId);
  }

  // Gọi repository để tạo cổng check-in.
  createGate(input: CreateGateRequest) {
    return this.repository.createGate(input);
  }

  // Gọi repository để cập nhật cổng check-in.
  updateGate(gateId: string, input: UpdateGateRequest) {
    return this.repository.updateGate(gateId, input);
  }

  // Gọi repository để vô hiệu hoá cổng check-in.
  deleteGate(gateId: string) {
    return this.repository.deleteGate(gateId);
  }

  // Gọi repository để lấy danh sách thiết bị check-in.
  listDevices(query: { concert_id?: string; gate_id?: string; limit: number }) {
    return this.repository.listDevices(query);
  }

  // Gọi repository để đăng ký thiết bị check-in.
  createDevice(input: CreateDeviceRequest) {
    return this.repository.createDevice(input);
  }

  // Gọi repository để cập nhật thiết bị check-in.
  updateDevice(deviceId: string, input: UpdateDeviceRequest) {
    return this.repository.updateDevice(deviceId, input);
  }

  // Gọi repository để thu hồi thiết bị check-in.
  deleteDevice(deviceId: string) {
    return this.repository.deleteDevice(deviceId);
  }

  // Gọi repository để lấy danh sách mapping cổng-khu vé.
  listGateZoneMappings(query: { concert_id?: string; gate_id?: string; limit: number }) {
    return this.repository.listGateZoneMappings(query);
  }

  // Gọi repository để tạo mapping cổng-khu vé.
  createGateZoneMapping(input: CreateGateZoneMappingRequest) {
    return this.repository.createGateZoneMapping(input);
  }

  // Gọi repository để thay toàn bộ mapping zone của một cổng.
  replaceGateZones(gateId: string, input: ReplaceGateZonesRequest) {
    return this.repository.replaceGateZones(gateId, input);
  }

  // Gọi repository để xoá một mapping cổng-khu vé.
  deleteGateZoneMapping(mappingId: string) {
    return this.repository.deleteGateZoneMapping(mappingId);
  }
}
