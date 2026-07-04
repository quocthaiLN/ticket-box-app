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

// Admin enqueue 1 job quét Drive cho 1 concert (chạy nhập thủ công ngoài lịch 0h).
export type GuestImportTriggerResponse = {
  concert_id: string;
  status: "SCAN_ENQUEUED";
  queue_job_id?: string;
};

export type GuestImportJobStatus = {
  id: string;
  concert_id: string;
  status: "PENDING" | "PROCESSING" | "DONE" | "PARTIAL" | "FAILED";
  total_rows: number;
  success_rows: number;
  error_rows: number;
  skipped_rows: number;
  file_url: string;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
};

export type GuestImportErrorItem = {
  id: string;
  row_number: number;
  error_code: string;
  error_message: string;
  raw_data: unknown;
};

export type GuestImportErrorsPage = {
  items: GuestImportErrorItem[];
  next_cursor: string | null;
  has_more: boolean;
};

export type GuestSummary = {
  guest_id: string;
  concert_id: string;
  full_name: string;
  email: string;
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
