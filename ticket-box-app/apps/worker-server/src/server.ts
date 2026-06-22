import { env } from "@ticketbox/config";
import {
  getExpireHoldsQueue,
  getNotificationsQueue,
  QUEUE_NAMES,
} from "@ticketbox/queue";
import { closeRedis } from "@ticketbox/redis";
import { createAiBioWorker } from "./workers/ai-bio.worker.js";
import { createEmailWorker } from "./workers/email.worker.js";
import { createExpireHoldsWorker } from "./workers/expire-holds.worker.js";
import { createGuestImportWorker } from "./workers/guest-import.worker.js";
import { createNotificationWorker } from "./workers/notification.worker.js";
import { startReminderScheduler } from "./schedulers/reminder.scheduler.js";

// ---------------------------------------------------------------------------
// Unhandled rejection safety net — worker errors must not crash the process
// ---------------------------------------------------------------------------

process.on("unhandledRejection", (reason, promise) => {
  console.error(
    "[worker-server] Unhandled rejection at:",
    promise,
    "reason:",
    reason,
  );
  // Do NOT exit — isolate the error so other workers keep running
});

process.on("uncaughtException", (err) => {
  console.error("[worker-server] Uncaught exception:", err.message, err.stack);
  // Exit on truly unexpected synchronous errors — BullMQ will restart if managed
  process.exit(1);
});

// ---------------------------------------------------------------------------
// Khởi tạo workers
// ---------------------------------------------------------------------------

const workers = [
  createExpireHoldsWorker(),
  createNotificationWorker(),
  createAiBioWorker(),
  createGuestImportWorker(),
  createEmailWorker(),
];

// ---------------------------------------------------------------------------
// Khởi tạo schedulers
// ---------------------------------------------------------------------------

const notificationQueue = getNotificationsQueue();
const expireHoldsQueue = getExpireHoldsQueue();

const reminderTimer = startReminderScheduler(notificationQueue);

const { expireHoldsIntervalMs, expireHoldsBatchSize, expireHoldsDryRun } =
  env.worker;

const expireHoldsTimer = setInterval(
  () => {
    expireHoldsQueue
      .add("expire-held-orders", {
        batch_size: expireHoldsBatchSize,
        dry_run: expireHoldsDryRun,
      })
      .catch((err: unknown) =>
        console.error("[worker-server] Failed to enqueue expire-holds:", err),
      );
  },
  Math.max(expireHoldsIntervalMs, 5_000),
);

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

async function shutdown(signal: string): Promise<void> {
  console.log(
    `\n[worker-server] Received ${signal} — shutting down gracefully...`,
  );

  clearInterval(reminderTimer);
  clearInterval(expireHoldsTimer);

  // Close workers first (drain in-flight jobs)
  await Promise.allSettled(workers.map((w) => w.close()));

  // Close queues (flush pending adds)
  await Promise.allSettled([
    notificationQueue.close(),
    expireHoldsQueue.close(),
  ]);

  // Close Redis connection last
  await closeRedis().catch((err) =>
    console.error("[worker-server] Redis close error:", err),
  );

  console.log("[worker-server] All workers stopped. Exiting.");
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

// ---------------------------------------------------------------------------
// Ready log
// ---------------------------------------------------------------------------

const redisAddr =
  env.redis.url !== "redis://localhost:6379"
    ? env.redis.url
    : `${env.redis.host}:${env.redis.port}`;

console.log(
  `[worker-server] TicketBox Worker Server started — ${workers.length} worker(s) listening`,
);
console.log(`  • Queues: ${Object.values(QUEUE_NAMES).join(", ")}`);
console.log(`  • Redis:  ${redisAddr} (shared via @ticketbox/redis)`);
console.log(
  `  • Expire-holds: every ${expireHoldsIntervalMs / 1000}s, batch=${expireHoldsBatchSize}, dry_run=${expireHoldsDryRun}`,
);
