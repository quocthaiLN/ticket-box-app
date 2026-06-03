export type CheckinScanRequest = {
  concert_id: string;
  device_id: string;
  gate_id: string;
  ticket_code?: string;
  qr_payload_hash?: string;
  scanned_at?: string;
  staff_user_id?: string;
};

export type CheckinPreloadQuery = {
  concert_id: string;
  gate_id: string;
  device_id: string;
  include_guests: boolean;
  limit: number;
  cursor?: string;
};

export type OfflineSyncItemRequest = {
  client_item_id: string;
  ticket_code?: string;
  qr_payload_hash?: string;
  concert_id: string;
  gate_id: string;
  zone_id?: string;
  scanned_at: string;
};

export type OfflineSyncRequest = {
  device_id: string;
  staff_user_id: string;
  batch_id: string;
  items: OfflineSyncItemRequest[];
};

export type OfflineBatchRequest = {
  batch_id: string;
  concert_id: string;
  device_id: string;
  gate_id: string;
  started_at?: string;
  ended_at?: string;
};

export type CheckinPlaceholderState = "pending_sprint_2";

export type CheckinScanResponse = {
  status: "scaffolded";
  scan_reference: string;
  received: CheckinScanRequest;
  placeholders: {
    qr_verification: CheckinPlaceholderState;
    gate_zone_validation: CheckinPlaceholderState;
    duplicate_scan_detection: CheckinPlaceholderState;
  };
};

export type CheckinPreloadResponse = {
  snapshot_id: string;
  concert_id: string;
  gate_id: string;
  device_id: string;
  generated_at: string;
  allowed_zone_ids: string[];
  tickets: Array<{
    ticket_id: string;
    ticket_code?: string;
    qr_payload_hash: string;
    concert_id: string;
    zone_id: string;
    status_snapshot: "ISSUED" | "CHECKED_IN" | "CANCELLED";
  }>;
  guests: Array<{
    guest_id: string;
    concert_id: string;
    zone_id: string;
    full_name: string;
    phone_masked?: string;
    status_snapshot: "INVITED" | "CHECKED_IN" | "CANCELLED";
  }>;
  placeholders: {
    gate_zone_validation: CheckinPlaceholderState;
  };
};

export type OfflineSyncItemStatus =
  | "success"
  | "duplicate"
  | "invalid_ticket"
  | "wrong_gate_zone"
  | "already_checked_in"
  | "conflict"
  | "scaffolded";

export type OfflineSyncResponse = {
  batch_id: string;
  accepted_item_count: number;
  results: Array<{
    client_item_id: string;
    status: OfflineSyncItemStatus;
    message: string;
  }>;
  placeholders: {
    idempotency_by_client_item_id: CheckinPlaceholderState;
    conflict_resolution: CheckinPlaceholderState;
    gate_zone_validation: CheckinPlaceholderState;
  };
};

export type OfflineBatchResponse = {
  batch_id: string;
  concert_id: string;
  device_id: string;
  gate_id: string;
  status: "scaffolded";
  placeholders: {
    idempotency_by_batch_id: CheckinPlaceholderState;
    item_sync: CheckinPlaceholderState;
  };
};
