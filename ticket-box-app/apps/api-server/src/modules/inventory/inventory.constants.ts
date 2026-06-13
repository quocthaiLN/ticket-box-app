/**
 * Tập giá trị hợp lệ cho `reason` khi release một order — nguồn sự thật duy nhất,
 * dùng chung cho cả validation (Zod) lẫn logic nghiệp vụ (repository).
 *
 * Lý do dùng hằng + enum ở tầng application thay vì sửa schema DB: cột
 * `orders.cancelled_reason` vẫn là `text`, nhưng request không hợp lệ bị chặn
 * ngay tại middleware validate (400) — không bao giờ chạm DB, và không còn
 * "magic string" rải rác trong code.
 */
export const RELEASE_REASONS = [
  "HOLD_EXPIRED",
  "USER_CANCELLED",
  "ADMIN_CANCELLED",
] as const;

export type ReleaseReason = (typeof RELEASE_REASONS)[number];

/** Lý do duy nhất khiến order chuyển sang EXPIRED (các lý do khác → CANCELLED). */
export const HOLD_EXPIRED_REASON: ReleaseReason = "HOLD_EXPIRED";
