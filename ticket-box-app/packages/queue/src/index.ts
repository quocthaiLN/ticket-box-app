/**
 * index.ts — Public API của @ticketbox/queue package.
 */

export { createRedisConnection } from "./connection.js";
export {
  QUEUE_NAMES,
  getExpireHoldsQueue,
  getNotificationsQueue,
  getAiBioQueue,
  getGuestImportQueue,
  getEmailQueue,
  closeAllQueues,
  type QueueName,
} from "./queues.js";
export type {
  ExpireHoldsJobData,
  NotificationChannel,
  NotificationJobData,
  AiBioJobData,
  GuestImportJobData,
  GuestImportScanData,
  EmailJobData,
  EmailAttachment,
} from "./jobs.js";
export {
  enqueueNotification,
  enqueueExpireHolds,
  enqueueAiBio,
  enqueueGuestImport,
  enqueueGuestImportScan,
  enqueueEmail,
} from "./enqueue.js";
