import type {
  CheckinPreloadQuery,
  CheckinPreloadResponse,
  CheckinScanRequest,
  CheckinScanResponse,
  OfflineBatchRequest,
  OfflineBatchResponse,
  OfflineSyncRequest,
  OfflineSyncResponse
} from "./checkin.types.js";
import { buildScaffoldOfflineSyncResponse } from "./checkin.sync.js";

export class CheckinRepository {
  async recordOnlineScan(input: CheckinScanRequest): Promise<CheckinScanResponse> {
    // TODO Sprint 2: verify QR, validate gate-zone, lock ticket row, detect duplicates, and write checkin_logs.
    return {
      status: "scaffolded",
      scan_reference: `scan_stub:${input.device_id}:${input.scanned_at ?? "server-time"}`,
      received: input,
      placeholders: {
        qr_verification: "pending_sprint_2",
        gate_zone_validation: "pending_sprint_2",
        duplicate_scan_detection: "pending_sprint_2"
      }
    };
  }

  async getPreloadSnapshot(query: CheckinPreloadQuery): Promise<CheckinPreloadResponse> {
    // TODO Sprint 2: load allowed zones, valid tickets, and guests from PostgreSQL for mobile SQLite preload.
    return {
      snapshot_id: `preload_stub:${query.device_id}:${query.concert_id}`,
      concert_id: query.concert_id,
      gate_id: query.gate_id,
      device_id: query.device_id,
      generated_at: new Date().toISOString(),
      allowed_zone_ids: [],
      tickets: [],
      guests: query.include_guests ? [] : [],
      placeholders: {
        gate_zone_validation: "pending_sprint_2"
      }
    };
  }

  async recordOfflineSyncBatch(input: OfflineSyncRequest): Promise<OfflineSyncResponse> {
    // TODO Sprint 2: enforce idempotency per client_item_id and resolve online/offline duplicate conflicts.
    return buildScaffoldOfflineSyncResponse(input);
  }

  async createOfflineBatch(input: OfflineBatchRequest): Promise<OfflineBatchResponse> {
    // TODO Sprint 2: persist offline_checkin_batches and enforce idempotency by batch token/key.
    return {
      batch_id: input.batch_id,
      concert_id: input.concert_id,
      device_id: input.device_id,
      gate_id: input.gate_id,
      status: "scaffolded",
      placeholders: {
        idempotency_by_batch_id: "pending_sprint_2",
        item_sync: "pending_sprint_2"
      }
    };
  }
}
