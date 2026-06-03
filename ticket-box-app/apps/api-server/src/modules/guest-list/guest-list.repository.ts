import type {
  GuestImportRequest,
  GuestImportResponse,
  GuestScanRequest,
  GuestScanResponse,
  GuestSearchQuery,
  GuestSummary
} from "./guest-list.types.js";

export class GuestListRepository {
  async createImportJob(input: GuestImportRequest): Promise<GuestImportResponse> {
    // TODO Sprint 2: store CSV metadata, enqueue guest import worker, and persist per-row validation errors.
    return {
      job_id: `guest_import_stub:${input.concert_id}`,
      concert_id: input.concert_id,
      status: "scaffolded",
      dry_run: input.dry_run,
      placeholders: {
        csv_parser: "pending_sprint_2",
        import_worker: "pending_sprint_2",
        row_validation: "pending_sprint_2"
      }
    };
  }

  async searchGuests(_query: GuestSearchQuery): Promise<GuestSummary[]> {
    // TODO Sprint 2: search guest_list by concert/name/phone/zone and filter by allowed gate zones.
    return [];
  }

  async recordGuestScan(input: GuestScanRequest): Promise<GuestScanResponse> {
    // TODO Sprint 2: validate guest status, detect duplicate check-in, validate gate-zone, and write audit log.
    return {
      status: "scaffolded",
      scan_reference: `guest_scan_stub:${input.device_id}:${input.scanned_at ?? "server-time"}`,
      received: input,
      placeholders: {
        duplicate_guest_checkin: "pending_sprint_2",
        gate_zone_validation: "pending_sprint_2"
      }
    };
  }
}
