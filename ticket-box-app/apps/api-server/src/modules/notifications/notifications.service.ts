import { getNotificationsQueue } from "@ticketbox/queue";
import { notificationsRepository } from "./notifications.repository.js";
import type { CreateNotificationInput, Notification } from "./notifications.types.js";

export const notificationsService = {
  /**
   * Tạo notification PENDING trong DB và enqueue job gửi.
   * Được gọi bởi payment/ticket/check-in sau event tương ứng.
   */
  async enqueue(input: CreateNotificationInput): Promise<Notification> {
    const notification = await notificationsRepository.create(input);

    try {
      const queue = getNotificationsQueue();
      await queue.add(
        "send-notification",
        {
          notification_id: notification.id,
          channel: input.channel,
          recipient_user_id: input.user_id,
          subject: input.subject,
          body: input.body,
        },
        {
          attempts: 3,
          backoff: { type: "exponential", delay: 5000 },
          removeOnComplete: { count: 100 },
          removeOnFail: { count: 50 },
        }
      );
    } catch (err) {
      // Queue không khả dụng không được phép làm crash luồng chính
      console.error("[notifications] Failed to enqueue job:", err);
    }

    return notification;
  },

  async getByUserId(userId: string): Promise<Notification[]> {
    return notificationsRepository.findByUserId(userId);
  },
};
