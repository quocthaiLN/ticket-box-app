/**
 * jobs.ts — Job payload types cho từng queue.
 *
 * Các type này phải được dùng cả ở api-server (khi enqueue) và worker-server (khi process).
 * Thay đổi payload type = cần migrate pending jobs nếu có.
 */

// ---------------------------------------------------------------------------
// expire-holds
// ---------------------------------------------------------------------------

export type ExpireHoldsJobData = {
  /** Giới hạn số order xử lý mỗi batch (default 50) */
  batch_size?: number;
  /** Scan and log expired holds without releasing inventory. */
  dry_run?: boolean;
};

// ---------------------------------------------------------------------------
// notifications
// ---------------------------------------------------------------------------

export type NotificationChannel = "EMAIL" | "PUSH" | "IN_APP";

export type NotificationJobData = {
  /** ID row trong bảng notifications */
  notification_id: string;
  channel: NotificationChannel;
  recipient_user_id: string;
  subject?: string;
  body: string;
  /** Số lần retry hiện tại (worker tự cập nhật) */
  attempt?: number;
};

// ---------------------------------------------------------------------------
// ai-bio
// ---------------------------------------------------------------------------

export type AiBioJobData = {
  /** ID row trong bảng artist_bio_jobs */
  job_id: string;
  concert_id: string;
  artist_name: string;
  /** Raw text/bio để AI tóm tắt (optional, có thể null nếu chỉ dùng artist_name) */
  source_text?: string;
};

// ---------------------------------------------------------------------------
// guest-import
// ---------------------------------------------------------------------------

export type GuestImportJobData = {
  /** ID row trong bảng guest_import_jobs */
  job_id: string;
  concert_id: string;
  /** Object key trên MinIO của file CSV đã upload */
  csv_object_key: string;
  uploaded_by_user_id: string;
};

// ---------------------------------------------------------------------------
// email — transactional email đã render sẵn (OTP, ...)
// ---------------------------------------------------------------------------

export type EmailJobData = {
  /** Địa chỉ người nhận */
  to: string;
  subject: string;
  /** Bản plain-text (bắt buộc để fallback) */
  text: string;
  /** Bản HTML (optional) */
  html?: string;
};
