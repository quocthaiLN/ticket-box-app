/**
 * notifications.repository.ts — Database access cho Notification module.
 * Sprint 1: stub interface — Sprint 4 implement với Prisma.
 */

import type { CreateNotificationInput, Notification, NotificationStatus } from "./notifications.types.js";

export const notificationsRepository = {
  /**
   * Tạo notification row mới với status PENDING.
   * Sprint 4: prisma.notification.create(...)
   */
  async create(_input: CreateNotificationInput): Promise<Notification> {
    throw new Error("notificationsRepository.create: not implemented — Sprint 4");
  },

  /**
   * Cập nhật status notification (SENT / FAILED).
   * Sprint 4: prisma.notification.update(...)
   */
  async updateStatus(
    _id: string,
    _status: NotificationStatus,
    _sentAt?: Date
  ): Promise<void> {
    throw new Error("notificationsRepository.updateStatus: not implemented — Sprint 4");
  },

  /**
   * Lấy danh sách notification của user (dùng cho admin/debug).
   * Sprint 4: prisma.notification.findMany(...)
   */
  async findByUserId(_userId: string): Promise<Notification[]> {
    throw new Error("notificationsRepository.findByUserId: not implemented — Sprint 4");
  },
};
