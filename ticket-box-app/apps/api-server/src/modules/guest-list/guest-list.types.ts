export type GuestImportRequest = {
  concert_id: string;
  file_object_key?: string;
  file_url?: string;
  default_zone_id?: string;
  dry_run: boolean;
  uploaded_by_user_id?: string;
};

export type GuestSearchQuery = {
  concert_id: string;
  q?: string;
  name?: string;
  phone?: string;
  zone_id?: string;
  gate_id?: string;
  limit: number;
  cursor?: string;
};

export type GuestScanRequest = {
  concert_id: string;
  device_id: string;
  gate_id: string;
  guest_id?: string;
  phone?: string;
  scanned_at?: string;
  staff_user_id?: string;
};

export type GuestListPlaceholderState = "pending_sprint_2";

export type GuestImportResponse = {
  job_id: string;
  concert_id: string;
  status: "PENDING" | "FAILED";
  file_url: string;
  queue_job_id?: string;
  dry_run: boolean;
  error_message?: string;
};

export type GuestSummary = {
  guest_id: string;
  concert_id: string;
  full_name: string;
  phone_masked?: string;
  zone_id: string;
  status: "INVITED" | "CHECKED_IN" | "CANCELLED";
};

export type GuestScanResponse = {
  result:
    | "SUCCESS"
    | "WRONG_GATE"
    | "ALREADY_CHECKED_IN"
    | "INVALID_GUEST"
    | "GUEST_CANCELLED"
    | "WRONG_CONCERT"
    | "DEVICE_NOT_ASSIGNED";
  guest_id?: string;
  gate_id: string;
  device_id: string;
  zone_id?: string | null;
  checked_in_at?: string;
  log_id?: string;
  reason?: string;
};
