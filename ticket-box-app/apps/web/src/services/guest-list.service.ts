import {
  apiGet,
  apiPatch,
  apiPost,
  type ApiCollectionResponse,
  type ApiResponse,
} from "../lib/api-client";

export type GuestImportStatus = "PENDING" | "PROCESSING" | "DONE" | "PARTIAL" | "FAILED";

export type GuestImportJob = {
  id: string;
  concert_id: string;
  status: GuestImportStatus;
  total_rows: number;
  success_rows: number;
  error_rows: number;
  skipped_rows: number;
  file_url: string;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
};

export type GuestImportError = {
  id: string;
  row_number: number;
  error_code: string;
  error_message: string;
  raw_data: unknown;
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

// Email service account cần được share (Viewer) thư mục Drive của concert.
export const GUEST_DRIVE_SERVICE_ACCOUNT = "storage@ticketbox-500711.iam.gserviceaccount.com";

// Admin gán/cập nhật thư mục Google Drive khách mời cho concert.
export async function setConcertDriveFolder(concertId: string, folder: string) {
  const response = await apiPatch<ApiResponse<{ id: string }>>(
    `/admin/concerts/${concertId}`,
    { guest_drive_folder_id: folder },
  );
  return response.data;
}

// Admin chạy nhập khách mời ngay (enqueue job quét Drive cho concert).
export async function triggerConcertGuestImport(concertId: string) {
  const response = await apiPost<
    ApiResponse<{ concert_id: string; status: string; queue_job_id?: string }>
  >(`/admin/concerts/${concertId}/guest-import-jobs`);
  return response.data;
}

// Lịch sử job import gần đây của concert.
export async function listConcertImportJobs(concertId: string) {
  const response = await apiGet<ApiCollectionResponse<GuestImportJob>>(
    `/admin/concerts/${concertId}/guest-import-jobs?limit=10`,
  );
  return response.data;
}

// Lỗi từng dòng của 1 job import.
export async function listImportJobErrors(jobId: string) {
  const response = await apiGet<ApiCollectionResponse<GuestImportError>>(
    `/admin/guest-import-jobs/${jobId}/errors?limit=100`,
  );
  return response.data;
}

// Danh sách guest đã nhập của concert.
export async function listConcertGuests(concertId: string, q = "") {
  const search = new URLSearchParams({ limit: "100" });
  if (q.trim()) search.set("q", q.trim());
  const response = await apiGet<ApiCollectionResponse<GuestSummary>>(
    `/admin/concerts/${concertId}/guests?${search}`,
  );
  return response.data;
}
