/**
 * notification.worker.ts — Worker gửi notification (email/push/in-app) và retry.
 * Sprint 1: stub chỉ log job data.
 * Sprint 4: implement gửi thật, cập nhật status SENT/FAILED trong DB.
 */

import { Worker, type Job } from "bullmq";
import { getRedisConnection, QUEUE_NAMES, type NotificationJobData } from "@ticketbox/queue";

export function createNotificationWorker(): Worker<NotificationJobData> {
  const worker = new Worker<NotificationJobData>(
    QUEUE_NAMES.NOTIFICATIONS,
    async (job: Job<NotificationJobData>) => {
      console.log(`[notification] Processing job ${job.id}`, {
        notification_id: job.data.notification_id,
        channel: job.data.channel,
        recipient: job.data.recipient_user_id,
      });
      // TODO Sprint 4: implement actual notification sending
      // await sendEmail(job.data) / sendPush(job.data) based on channel
      // await notificationRepository.updateStatus(job.data.notification_id, "SENT");
      console.log(`[notification] Job ${job.id} completed (stub)`);
    },
    { connection: getRedisConnection() }
  );

  worker.on("completed", (job) =>
    console.log(`[notification] Job ${job.id} succeeded`)
  );
  worker.on("failed", (job, err) =>
    console.error(`[notification] Job ${job?.id} failed:`, err.message)
  );

  return worker;
}
