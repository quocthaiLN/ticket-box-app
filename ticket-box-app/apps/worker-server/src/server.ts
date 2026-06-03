import { Queue } from "bullmq";
import { getRedisConnection, QUEUE_NAMES } from "@ticketbox/queue";
import { createAiBioWorker } from "./workers/ai-bio.worker.js";
import { createExpireHoldsWorker } from "./workers/expire-holds.worker.js";
import { createGuestImportWorker } from "./workers/guest-import.worker.js";
import { createNotificationWorker } from "./workers/notification.worker.js";
import { startReminderScheduler } from "./schedulers/reminder.scheduler.js";

// ---------------------------------------------------------------------------
// Khởi tạo workers
// Tất cả dùng chung Redis instance qua getRedisConnection() từ @ticketbox/queue
// → @ticketbox/queue → @ticketbox/redis (singleton)
// ---------------------------------------------------------------------------

const workers = [
  createExpireHoldsWorker(),
  createNotificationWorker(),
  createAiBioWorker(),
  createGuestImportWorker(),
];

// ---------------------------------------------------------------------------
// Khởi tạo schedulers
// ---------------------------------------------------------------------------

const notificationQueue = new Queue(QUEUE_NAMES.NOTIFICATIONS, {
  connection: getRedisConnection(),
});

const reminderTimer = startReminderScheduler(notificationQueue);

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

async function shutdown(signal: string): Promise<void> {
  console.log(
    `\n[worker-server] Received ${signal} — shutting down gracefully...`,
  );

  clearInterval(reminderTimer);

  await Promise.all(workers.map((w) => w.close()));
  await notificationQueue.close();

  console.log("[worker-server] All workers stopped. Exiting.");
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

// ---------------------------------------------------------------------------
// Ready
// ---------------------------------------------------------------------------

const redisAddr =
  process.env.REDIS_URL ??
  `${process.env.REDIS_HOST ?? "localhost"}:${process.env.REDIS_PORT ?? 6379}`;

console.log(
  `[worker-server] TicketBox Worker Server started — ${workers.length} worker(s) listening`,
);
console.log(`  • Queues: ${Object.values(QUEUE_NAMES).join(", ")}`);
console.log(`  • Redis:  ${redisAddr} (shared via @ticketbox/redis)`);
