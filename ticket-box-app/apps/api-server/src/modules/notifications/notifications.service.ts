/**
 * notifications.service.ts — Business logic cho Notification module.
 *
 * Luồng Sprint 4:
 *   1. Tạo row notifications với status PENDING (bằng repository).
 *   2. Enqueue job vào queue "notifications" (BullMQ).
 *   3. Worker nhận job, gửi thật, cập nhật status SENT/FAILED.
 *
 * Sprint 1: chỉ định nghĩa contract, throw not implemented.
 */

import type { CreateNotificationInput, Notification } from "./notifications.types.js";

export const notificationsService = {
  /**
   * Tạo notification PENDING và enqueue job gửi.
   *
   * Được gọi bởi các module khác sau event:
   *   - payment success → gửi ticket confirmation
   *   - ticket issued → gửi e-ticket
   *   - check-in success → gửi confirmation
   *
   * Sprint 4: notificationsRepository.create() + notificationsQueue.add()
   */
  async enqueue(_input: CreateNotificationInput): Promise<Notification> {
    throw new Error("notificationsService.enqueue: not implemented — Sprint 4");
  },

  /**
   * Lấy danh sách notification của user (debug/admin).
   * Sprint 4: notificationsRepository.findByUserId()
   */
  async getByUserId(_userId: string): Promise<Notification[]> {
    throw new Error("notificationsService.getByUserId: not implemented — Sprint 4");
  },
};
