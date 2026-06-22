import { Queue } from "bullmq";
import { getRedisConnection, QUEUE_NAMES } from "@ticketbox/queue";
import { closeRedis } from "@ticketbox/redis";
import { createAiBioWorker } from "./workers/ai-bio.worker.js";
import { createExpireHoldsWorker } from "./workers/expire-holds.worker.js";
import { createGuestImportWorker } from "./workers/guest-import.worker.js";
import { createNotificationWorker } from "./workers/notification.worker.js";
import { startReminderScheduler } from "./schedulers/reminder.scheduler.js";

// ---------------------------------------------------------------------------
// Unhandled rejection safety net — worker errors must not crash the process
// ---------------------------------------------------------------------------

process.on("unhandledRejection", (reason, promise) => {
  console.error("[worker-server] Unhandled rejection at:", promise, "reason:", reason);
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

const expireHoldsIntervalMs = Number(
  process.env.EXPIRE_HOLDS_INTERVAL_MS ?? 60_000,
);
const expireHoldsBatchSize = Number(
  process.env.EXPIRE_HOLDS_BATCH_SIZE ?? 50,
);
const expireHoldsDryRun = process.env.EXPIRE_HOLDS_DRY_RUN === "true";

const expireHoldsTimer = setInterval(() => {
  expireHoldsQueue
    .add("expire-held-orders", {
      batch_size: expireHoldsBatchSize,
      dry_run: expireHoldsDryRun,
    })
    .catch((err: unknown) =>
      console.error("[worker-server] Failed to enqueue expire-holds:", err),
    );
}, Math.max(expireHoldsIntervalMs, 5_000));

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
  process.env.REDIS_URL ??
  `${process.env.REDIS_HOST ?? "localhost"}:${process.env.REDIS_PORT ?? 6379}`;

console.log(
  `[worker-server] TicketBox Worker Server started — ${workers.length} worker(s) listening`,
);
console.log(`  • Queues: ${Object.values(QUEUE_NAMES).join(", ")}`);
console.log(`  • Redis:  ${redisAddr} (shared via @ticketbox/redis)`);
console.log(
  `  • Expire-holds: every ${expireHoldsIntervalMs / 1000}s, batch=${expireHoldsBatchSize}, dry_run=${expireHoldsDryRun}`,
);
