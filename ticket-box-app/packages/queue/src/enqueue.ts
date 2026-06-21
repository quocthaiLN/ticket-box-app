/**
 * enqueue.ts — Helper functions để API server enqueue jobs.
 * Import các hàm này thay vì gọi trực tiếp queue instance để giữ
 * contract nhất quán giữa api-server và worker-server.
 */

import {
  getAiBioQueue,
  getEmailQueue,
  getExpireHoldsQueue,
  getGuestImportQueue,
  getNotificationsQueue,
} from "./queues.js";
import type {
  AiBioJobData,
  EmailJobData,
  ExpireHoldsJobData,
  GuestImportJobData,
  NotificationJobData,
} from "./jobs.js";

const DEFAULT_NOTIFICATION_OPTS = {
  attempts: 3,
  backoff: { type: "exponential" as const, delay: 5_000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 50 },
};

const DEFAULT_WORKER_OPTS = {
  attempts: 5,
  backoff: { type: "exponential" as const, delay: 10_000 },
  removeOnComplete: { count: 50 },
  removeOnFail: { count: 100 },
};

/**
 * Enqueue một notification job.
 */
export async function enqueueNotification(data: NotificationJobData): Promise<string> {
  const queue = getNotificationsQueue();
  const job = await queue.add("send-notification", data, DEFAULT_NOTIFICATION_OPTS);
  return job.id ?? "";
}

/**
 * Enqueue một expire-holds batch job (thường gọi từ scheduler).
 */
export async function enqueueExpireHolds(
  data: ExpireHoldsJobData = {}
): Promise<string> {
  const queue = getExpireHoldsQueue();
  const job = await queue.add("expire-holds-batch", data, {
    attempts: 3,
    backoff: { type: "fixed" as const, delay: 5_000 },
    removeOnComplete: { count: 20 },
    removeOnFail: { count: 20 },
  });
  return job.id ?? "";
}

/**
 * Enqueue một AI bio generation job.
 */
export async function enqueueAiBio(data: AiBioJobData): Promise<string> {
  const queue = getAiBioQueue();
  const job = await queue.add("generate-artist-bio", data, DEFAULT_WORKER_OPTS);
  return job.id ?? "";
}

/**
 * Enqueue một guest CSV import job.
 */
export async function enqueueGuestImport(data: GuestImportJobData): Promise<string> {
  const queue = getGuestImportQueue();
  const job = await queue.add("import-guest-csv", data, DEFAULT_WORKER_OPTS);
  return job.id ?? "";
}

/**
 * Enqueue một email transactional (OTP, ...). Worker-server sẽ gửi qua SMTP.
 */
export async function enqueueEmail(data: EmailJobData): Promise<string> {
  const queue = getEmailQueue();
  const job = await queue.add("send-email", data, DEFAULT_NOTIFICATION_OPTS);
  return job.id ?? "";
}
