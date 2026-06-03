import type { OfflineSyncRequest, OfflineSyncResponse } from "./checkin.types.js";

export function buildScaffoldOfflineSyncResponse(input: OfflineSyncRequest): OfflineSyncResponse {
  return {
    batch_id: input.batch_id,
    accepted_item_count: input.items.length,
    results: input.items.map((item) => ({
      client_item_id: item.client_item_id,
      status: "scaffolded",
      message: "Offline sync item accepted by Sprint 1 scaffold; real validation is pending Sprint 2."
    })),
    placeholders: {
      idempotency_by_client_item_id: "pending_sprint_2",
      conflict_resolution: "pending_sprint_2",
      gate_zone_validation: "pending_sprint_2"
    }
  };
}
