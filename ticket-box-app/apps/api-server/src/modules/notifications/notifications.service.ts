import { enqueueNotification } from "@ticketbox/queue";
import type { NotificationJobData } from "@ticketbox/queue";
import { notificationsRepository } from "./notifications.repository.js";
import type {
  AdminNotificationsQuery,
  CreateNotificationInput,
  Notification,
} from "./notifications.types.js";

export const notificationsService = {
  /**
   * Tạo notification PENDING trong DB và enqueue job gửi.
   * Được gọi bởi payment/ticket/check-in sau event tương ứng.
   */
  async enqueue(input: CreateNotificationInput): Promise<Notification> {
    const notification = await notificationsRepository.create(input);

    try {
      await enqueueNotification({
        notification_id: notification.id,
        channel: notification.channel as NotificationJobData["channel"],
        recipient_user_id: notification.user_id ?? "",
        subject: (notification.payload.subject as string | undefined),
        body: (notification.payload.body as string | undefined) ?? "",
      });
    } catch (err) {
      console.error("[notifications] Failed to enqueue job:", err);
    }

    return notification;
  },

  /**
   * Enqueue BullMQ job cho một notification đã tồn tại trong DB.
   * Dùng sau khi createMany (ví dụ: payment.repository confirmOrderPayment).
   */
  async enqueueExisting(notification: {
    id: string;
    user_id: string | null;
    channel: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    try {
      await enqueueNotification({
        notification_id: notification.id,
        channel: notification.channel as NotificationJobData["channel"],
        recipient_user_id: notification.user_id ?? "",
        subject: (notification.payload.subject as string | undefined),
        body: (notification.payload.body as string | undefined) ?? "",
      });
    } catch (err) {
      console.error(
        `[notifications] Failed to enqueue existing job ${notification.id}:`,
        err,
      );
    }
  },

  async list(query: AdminNotificationsQuery) {
    return notificationsRepository.findAll(query);
  },

  async getById(id: string): Promise<Notification | null> {
    return notificationsRepository.findById(id);
  },

  async retry(id: string): Promise<Notification | null> {
    const notification = await notificationsRepository.resetToPending(id);
    if (!notification) return null;

    try {
      await enqueueNotification({
        notification_id: notification.id,
        channel: notification.channel as NotificationJobData["channel"],
        recipient_user_id: notification.user_id ?? "",
        subject: (notification.payload.subject as string | undefined),
        body: (notification.payload.body as string | undefined) ?? "",
      });
    } catch (err) {
      console.error(`[notifications] Failed to re-enqueue job ${id}:`, err);
    }

    return notification;
  },

  async getByUserId(userId: string): Promise<Notification[]> {
    return notificationsRepository.findByUserId(userId);
  },
};
