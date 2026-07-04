export type CheckinScanRequest = {
  concert_id: string;
  device_id: string;
  gate_id: string;
  qr_payload?: unknown;
  qr_token?: string;
  qr_signature?: string;
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
  type?: "TICKET" | "GUEST";
  ticket_id?: string;
  guest_id?: string;
  phone?: string;
  qr_token?: string;
  ticket_code?: string;
  qr_payload_hash?: string;
  concert_id: string;
  gate_id: string;
  seat_zone_id?: string;
  zone_id?: string;
  scanned_at: string;
};

export type OfflineSyncRequest = {
  device_id?: string;
  staff_user_id?: string;
  batch_id: string;
  concert_id?: string;
  gate_id?: string;
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

export type CheckinScanResponse = {
  result:
    | "SUCCESS"
    | "WRONG_GATE"
    | "ALREADY_CHECKED_IN"
    | "INVALID_TICKET"
    | "EXPIRED_OR_CANCELLED"
    | "WRONG_CONCERT"
    | "DEVICE_NOT_ASSIGNED"
    | "GATE_NOT_ACTIVE";
  ticket_id?: string;
  gate_id: string;
  device_id: string;
  zone_id?: string;
  checked_in_at?: string;
  log_id?: string;
  reason?: string;
};

export type CheckinPreloadResponse = {
  snapshot_id: string;
  concert_id: string;
  gate_id: string;
  device_id: string;
  generated_at: string;
  device: {
    id: string;
    device_code: string;
    name: string | null;
    status: string;
    last_seen_at: string | null;
  };
  gate: {
    id: string;
    code: string;
    name: string;
    is_active: boolean;
  };
  concert: {
    id: string;
    title: string;
    starts_at: string;
  };
  allowed_zone_ids: string[];
  allowed_seat_zones: Array<{
    id: string;
    code: string;
    name: string;
  }>;
  tickets: Array<{
    ticket_id: string;
    qr_payload_hash: string;
    qr_signature?: string | null;
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
  offline: {
    qr_signature_supported: boolean;
    full_offline_sync_ready: boolean;
    notes: string[];
  };
};

export type OfflineSyncItemStatus =
  | "SUCCESS"
  | "ALREADY_CHECKED_IN"
  | "WRONG_GATE"
  | "INVALID_TICKET"
  | "INVALID_GUEST"
  | "CONFLICT"
  | "DUPLICATE_ITEM"
  | "ERROR";

export type OfflineSyncResponse = {
  batch_id: string;
  status: "PENDING" | "SYNCING" | "DONE" | "FAILED";
  accepted_item_count: number;
  conflict_item_count: number;
  results: Array<{
    client_item_id: string;
    status: OfflineSyncItemStatus;
    message: string;
    ticket_id?: string | null;
    guest_id?: string | null;
  }>;
};

export type OfflineBatchResponse = {
  batch_id: string;
  concert_id: string;
  device_id: string;
  gate_id: string;
  status: "PENDING" | "SYNCING" | "DONE" | "FAILED";
};

export type GateDto = {
  id: string;
  concert_id: string;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  zones?: Array<{ id: string; code: string; name: string }>;
};

export type DeviceDto = {
  id: string;
  device_code: string;
  staff_id: string;
  concert_id: string;
  gate_id: string;
  name: string | null;
  status: string;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
};

export type GateZoneMappingDto = {
  id: string;
  gate_id: string;
  seat_zone_id: string;
  concert_id: string;
  created_at: string;
};

export type CreateGateRequest = {
  concert_id: string;
  code: string;
  name: string;
  description?: string;
  is_active: boolean;
  sort_order: number;
};

export type UpdateGateRequest = {
  code?: string;
  name?: string;
  description?: string | null;
  is_active?: boolean;
  sort_order?: number;
};

export type CreateDeviceRequest = {
  device_code: string;
  staff_id: string;
  concert_id: string;
  gate_id: string;
  name?: string;
};

export type UpdateDeviceRequest = {
  device_code?: string;
  staff_id?: string;
  gate_id?: string;
  name?: string | null;
  status?: "ACTIVE" | "REVOKED" | "LOST";
};

export type CreateGateZoneMappingRequest = {
  gate_id: string;
  seat_zone_id: string;
};

export type ReplaceGateZonesRequest = {
  seat_zone_ids: string[];
};
