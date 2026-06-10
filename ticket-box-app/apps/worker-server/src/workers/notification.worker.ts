import { Worker, type Job } from "bullmq";
import { prisma, NotificationStatus } from "@ticketbox/database";
import { getRedisConnection, QUEUE_NAMES, type NotificationJobData } from "@ticketbox/queue";

const MAX_ATTEMPTS = 3;

// ---------------------------------------------------------------------------
// Mock providers — Sprint 4: log-based; swap with real SDK in production
// ---------------------------------------------------------------------------

async function sendEmail(data: NotificationJobData): Promise<void> {
  console.log(
    `[notification:email] → user=${data.recipient_user_id} subject="${data.subject ?? "(no subject)"}" body="${data.body.slice(0, 80)}"`,
  );
  // Production: call nodemailer / SendGrid / SES here
}

async function sendPush(data: NotificationJobData): Promise<void> {
  console.log(
    `[notification:push] → user=${data.recipient_user_id} body="${data.body.slice(0, 80)}"`,
  );
  // Production: call FCM / APNs here
}

async function sendSms(data: NotificationJobData): Promise<void> {
  console.log(
    `[notification:sms] → user=${data.recipient_user_id} body="${data.body.slice(0, 80)}"`,
  );
  // Production: call Twilio / ESMS here
}

async function dispatchByChannel(data: NotificationJobData): Promise<void> {
  switch (data.channel) {
    case "EMAIL":
      return sendEmail(data);
    case "PUSH":
    case "IN_APP":
      return sendPush(data);
    default:
      return sendSms(data);
  }
}

// ---------------------------------------------------------------------------
// Status helpers — update DB after processing
// ---------------------------------------------------------------------------

async function markSent(notificationId: string): Promise<void> {
  await prisma.notification.update({
    where: { id: notificationId },
    data: {
      status: NotificationStatus.SENT,
      sentAt: new Date(),
      errorMessage: null,
      attempts: { increment: 1 },
    },
  });
}

async function markFailed(
  notificationId: string,
  errorMessage: string,
): Promise<void> {
  await prisma.notification.update({
    where: { id: notificationId },
    data: {
      status: NotificationStatus.FAILED,
      errorMessage: errorMessage.slice(0, 500),
      attempts: { increment: 1 },
    },
  });
}

async function incrementAttempts(notificationId: string): Promise<void> {
  await prisma.notification.update({
    where: { id: notificationId },
    data: { attempts: { increment: 1 } },
  });
}

// ---------------------------------------------------------------------------
// Worker factory
// ---------------------------------------------------------------------------

export function createNotificationWorker(): Worker<NotificationJobData> {
  const worker = new Worker<NotificationJobData>(
    QUEUE_NAMES.NOTIFICATIONS,
    async (job: Job<NotificationJobData>) => {
      const { notification_id: notificationId } = job.data;
      const attemptNumber = (job.attemptsMade ?? 0) + 1;

      console.log(
        `[notification] Processing job=${job.id} notification=${notificationId} attempt=${attemptNumber}`,
      );

      // Verify notification still exists and is PENDING
      const row = await prisma.notification.findUnique({
        where: { id: notificationId },
        select: { id: true, status: true },
      });

      if (!row) {
        console.warn(
          `[notification] Notification ${notificationId} not found — skipping`,
        );
        return;
      }

      if (row.status === "SENT") {
        console.log(
          `[notification] Notification ${notificationId} already SENT — skipping`,
        );
        return;
      }

      try {
        await dispatchByChannel(job.data);
        await markSent(notificationId);
        console.log(
          `[notification] Job=${job.id} notification=${notificationId} → SENT`,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const isFinalAttempt = attemptNumber >= MAX_ATTEMPTS;

        if (isFinalAttempt) {
          await markFailed(notificationId, msg);
          console.error(
            `[notification] Job=${job.id} notification=${notificationId} → FAILED (exhausted retries): ${msg}`,
          );
        } else {
          await incrementAttempts(notificationId);
          console.warn(
            `[notification] Job=${job.id} notification=${notificationId} → retrying (attempt ${attemptNumber}/${MAX_ATTEMPTS}): ${msg}`,
          );
          // Re-throw so BullMQ retries the job with exponential backoff
          throw err;
        }
      }
    },
    {
      connection: getRedisConnection(),
      concurrency: 5,
    },
  );

  worker.on("completed", (job) =>
    console.log(`[notification] Job ${job.id} completed`),
  );

  worker.on("failed", (job, err) =>
    console.error(
      `[notification] Job ${job?.id} failed permanently: ${err.message}`,
    ),
  );

  worker.on("error", (err) =>
    console.error("[notification] Worker error:", err.message),
  );

  return worker;
}
