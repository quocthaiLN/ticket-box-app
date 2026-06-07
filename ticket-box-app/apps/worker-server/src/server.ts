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
const expireHoldsQueue = new Queue(QUEUE_NAMES.EXPIRE_HOLDS, {
  connection: getRedisConnection(),
});

const reminderTimer = startReminderScheduler(notificationQueue);
const expireHoldsIntervalMs = Number(process.env.EXPIRE_HOLDS_INTERVAL_MS ?? 60_000);
const expireHoldsBatchSize = Number(process.env.EXPIRE_HOLDS_BATCH_SIZE ?? 50);
const expireHoldsDryRun = process.env.EXPIRE_HOLDS_DRY_RUN === "true";
// Đưa job expire-holds vào queue theo chu kỳ cấu hình.
const expireHoldsTimer = setInterval(() => {
  void expireHoldsQueue.add("expire-held-orders", {
    batch_size: expireHoldsBatchSize,
    dry_run: expireHoldsDryRun,
  });
}, Math.max(expireHoldsIntervalMs, 5_000));

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

// Đóng worker, queue và timer an toàn khi process nhận tín hiệu dừng.
async function shutdown(signal: string): Promise<void> {
  console.log(
    `\n[worker-server] Received ${signal} — shutting down gracefully...`,
  );

  clearInterval(reminderTimer);
  clearInterval(expireHoldsTimer);

  await Promise.all(workers.map((w) => w.close()));
  await notificationQueue.close();
  await expireHoldsQueue.close();

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
