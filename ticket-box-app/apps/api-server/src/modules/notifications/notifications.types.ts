/**
 * notifications.types.ts — Types cho Notification module.
 * Dùng chung giữa router, service, repository.
 */

export type NotificationChannel = "EMAIL" | "PUSH" | "IN_APP";

export type NotificationStatus = "PENDING" | "SENT" | "FAILED";

/** Row trong bảng notifications */
export type Notification = {
  id: string;
  user_id: string;
  channel: NotificationChannel;
  subject: string | null;
  body: string;
  status: NotificationStatus;
  sent_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

/** Input để tạo notification mới */
export type CreateNotificationInput = {
  user_id: string;
  channel: NotificationChannel;
  subject?: string;
  body: string;
};
