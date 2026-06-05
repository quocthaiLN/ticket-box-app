/**
 * expire-holds.worker.ts — Worker xử lý job hết hạn giữ vé (HELD → CANCELLED).
 * Sprint 1: stub chỉ log job data, chưa thực sự release inventory.
 * Sprint 2: query orders WHERE status=HELD AND hold_expires_at < NOW(), gọi releaseHold().
 */

import { Worker, type Job } from "bullmq";
import { getRedisConnection, QUEUE_NAMES, type ExpireHoldsJobData } from "@ticketbox/queue";

export function createExpireHoldsWorker(): Worker<ExpireHoldsJobData> {
  const worker = new Worker<ExpireHoldsJobData>(
    QUEUE_NAMES.EXPIRE_HOLDS,
    async (job: Job<ExpireHoldsJobData>) => {
      console.log(`[expire-holds] Processing job ${job.id}`, job.data);
      // TODO Sprint 2: implement actual hold expiration logic
      // const batchSize = job.data.batch_size ?? 50;
      // const expiredOrders = await orderRepository.findExpiredHolds(batchSize);
      // for (const order of expiredOrders) { await inventoryService.releaseHold(order.id); }
      console.log(`[expire-holds] Job ${job.id} completed (stub)`);
    },
    { connection: getRedisConnection() }
  );

  worker.on("completed", (job) =>
    console.log(`[expire-holds] Job ${job.id} succeeded`)
  );
  worker.on("failed", (job, err) =>
    console.error(`[expire-holds] Job ${job?.id} failed:`, err.message)
  );

  return worker;
}
