/**
 * queues.ts — Queue names constants và Queue factory.
 *
 * Queue name phải đồng nhất giữa api-server (enqueue) và worker-server (consume).
 * Thay đổi tên queue = breaking change → cần migration nếu có jobs đang chờ.
 */

import { Queue } from "bullmq";
import { createRedisConnection } from "./connection.js";

/** Tên tất cả queue trong hệ thống */
export const QUEUE_NAMES = {
  /** Release order HELD hết hold_expires_at về inventory */
  EXPIRE_HOLDS: "expire-holds",
  /** Gửi notification (email/push/in-app) và retry */
  NOTIFICATIONS: "notifications",
  /** Gọi AI tạo artist bio cho concert */
  AI_BIO: "ai-bio",
  /** Import CSV danh sách khách VIP */
  GUEST_IMPORT: "guest-import",
  /** Gửi email transactional (OTP, ...) qua SMTP */
  EMAIL: "email",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

// ---------------------------------------------------------------------------
// Queue instances (lazy — tạo khi gọi lần đầu)
// Tất cả dùng chung Redis instance từ @ticketbox/redis
// ---------------------------------------------------------------------------

let _expireHoldsQueue: Queue | null = null;
let _notificationsQueue: Queue | null = null;
let _aiBioQueue: Queue | null = null;
let _guestImportQueue: Queue | null = null;
let _emailQueue: Queue | null = null;

export function getExpireHoldsQueue(): Queue {
  return (_expireHoldsQueue ??= new Queue(QUEUE_NAMES.EXPIRE_HOLDS, {
    connection: createRedisConnection(),
  }));
}

export function getNotificationsQueue(): Queue {
  return (_notificationsQueue ??= new Queue(QUEUE_NAMES.NOTIFICATIONS, {
    connection: createRedisConnection(),
  }));
}

export function getAiBioQueue(): Queue {
  return (_aiBioQueue ??= new Queue(QUEUE_NAMES.AI_BIO, {
    connection: createRedisConnection(),
  }));
}

export function getGuestImportQueue(): Queue {
  return (_guestImportQueue ??= new Queue(QUEUE_NAMES.GUEST_IMPORT, {
    connection: createRedisConnection(),
  }));
}

export function getEmailQueue(): Queue {
  return (_emailQueue ??= new Queue(QUEUE_NAMES.EMAIL, {
    connection: createRedisConnection(),
  }));
}

/**
 * Đóng tất cả queue singleton đã được khởi tạo (graceful shutdown).
 * Chỉ close những queue thực sự đã tạo (lazy — nếu chưa gọi get*Queue thì bỏ qua).
 */
export async function closeAllQueues(): Promise<void> {
  const queues = [
    _expireHoldsQueue,
    _notificationsQueue,
    _aiBioQueue,
    _guestImportQueue,
    _emailQueue,
  ].filter((q): q is Queue => q !== null);

  await Promise.allSettled(queues.map((q) => q.close()));

  _expireHoldsQueue = null;
  _notificationsQueue = null;
  _aiBioQueue = null;
  _guestImportQueue = null;
  _emailQueue = null;
}
