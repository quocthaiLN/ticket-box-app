export type NotificationChannel = "EMAIL" | "APP" | "SMS" | "ZALO";
export type NotificationStatus = "PENDING" | "SENT" | "FAILED";
export type NotificationType =
  | "SYSTEM"
  | "ORDER_CONFIRMED"
  | "PAYMENT_FAILED"
  | "TICKET_ISSUED"
  | "CONCERT_UPDATED"
  | "CHECKIN_ALERT"
  | "ARTIST_BIO_READY";

export type Notification = {
  id: string;
  user_id: string | null;
  concert_id: string | null;
  ticket_id: string | null;
  channel: NotificationChannel;
  type: NotificationType;
  status: NotificationStatus;
  payload: Record<string, unknown>;
  attempts: number;
  error_message: string | null;
  sent_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export type CreateNotificationInput = {
  user_id?: string | null;
  concert_id?: string | null;
  ticket_id?: string | null;
  channel: NotificationChannel;
  type?: NotificationType;
  payload?: Record<string, unknown>;
  subject?: string;
  body?: string;
};

export type AdminNotificationsQuery = {
  concert_id?: string;
  ticket_id?: string;
  channel?: string;
  status?: string;
  limit?: number;
  cursor?: string;
};

export type UpdateStatusOptions = {
  errorMessage?: string;
  sentAt?: Date;
};
