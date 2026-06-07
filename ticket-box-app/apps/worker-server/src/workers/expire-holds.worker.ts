/**
 * Worker xu ly order HELD het han.
 *
 * Worker chi query expired holds va goi shared database adapter. Release
 * inventory/counter van nam trong transaction cua @ticketbox/database.
 */

import { Worker, type Job } from "bullmq";
import { expireHeldOrder, findExpiredHeldOrders } from "@ticketbox/database";
import {
  getRedisConnection,
  QUEUE_NAMES,
  type ExpireHoldsJobData,
} from "@ticketbox/queue";

// Tạo BullMQ worker định kỳ release các order giữ vé đã hết hạn.
export function createExpireHoldsWorker(): Worker<ExpireHoldsJobData> {
  const worker = new Worker<ExpireHoldsJobData>(
    QUEUE_NAMES.EXPIRE_HOLDS,
    // Xử lý một job expire-holds: quét order hết hạn và release từng order.
    async (job: Job<ExpireHoldsJobData>) => {
      const batchSize = Math.max(1, Math.min(job.data.batch_size ?? 50, 500));
      const dryRun = job.data.dry_run === true;
      const expiredOrders = await findExpiredHeldOrders(batchSize);

      let releasedCount = 0;
      let skippedCount = 0;
      let failedCount = 0;

      console.log(
        `[expire-holds] scan job=${job.id} scanned=${expiredOrders.length} batch_size=${batchSize} dry_run=${dryRun}`,
      );

      for (const order of expiredOrders) {
        try {
          if (dryRun) {
            skippedCount += 1;
            console.log(
              `[expire-holds] dry-run order=${order.orderId} hold_expires_at=${order.holdExpiresAt.toISOString()}`,
            );
            continue;
          }

          const result = await expireHeldOrder(order.orderId);

          if (result.status === "EXPIRED" && result.releasedItems.length > 0) {
            releasedCount += 1;
          } else {
            skippedCount += 1;
          }

          console.log(
            `[expire-holds] order=${order.orderId} status=${result.status} released_items=${result.releasedItems.length}`,
          );
        } catch (error) {
          failedCount += 1;
          const message =
            error instanceof Error ? error.message : String(error);
          console.error(
            `[expire-holds] order=${order.orderId} failed=${message}`,
          );
        }
      }

      console.log(
        `[expire-holds] done job=${job.id} scanned=${expiredOrders.length} released=${releasedCount} skipped=${skippedCount} failed=${failedCount}`,
      );

      return {
        scanned_count: expiredOrders.length,
        released_count: releasedCount,
        skipped_count: skippedCount,
        failed_count: failedCount,
      };
    },
    { connection: getRedisConnection() },
  );

  worker.on("completed", (job) =>
    console.log(`[expire-holds] Job ${job.id} succeeded`),
  );
  worker.on("failed", (job, err) =>
    console.error(`[expire-holds] Job ${job?.id} failed:`, err.message),
  );

  return worker;
}
