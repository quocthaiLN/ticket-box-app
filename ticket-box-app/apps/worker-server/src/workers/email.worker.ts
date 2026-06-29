import { Worker, type Job } from "bullmq";
import {
  createRedisConnection,
  QUEUE_NAMES,
  type EmailJobData,
} from "@ticketbox/queue";
import { sendEmail } from "../shared/mailer.js";

export function createEmailWorker(): Worker<EmailJobData> {
  const worker = new Worker<EmailJobData>(
    QUEUE_NAMES.EMAIL,
    async (job: Job<EmailJobData>) => {
      const attemptNumber = (job.attemptsMade ?? 0) + 1;
      console.log(
        `[email] Processing job=${job.id} to=${job.data.to} subject="${job.data.subject}" attempt=${attemptNumber}`,
      );

      // Throw nếu gửi lỗi → BullMQ retry theo backoff (xem DEFAULT_NOTIFICATION_OPTS)
      await sendEmail(job.data);

      console.log(`[email] Job=${job.id} to=${job.data.to} → SENT`);
    },
    {
      connection: createRedisConnection(),
      concurrency: 5,
    },
  );

  worker.on("completed", (job) =>
    console.log(`[email] Job ${job.id} completed`),
  );

  worker.on("failed", (job, err) =>
    console.error(
      `[email] Job ${job?.id} failed (to=${job?.data.to}): ${err.message}`,
    ),
  );

  worker.on("error", (err) =>
    console.error("[email] Worker error:", err.message),
  );

  return worker;
}
