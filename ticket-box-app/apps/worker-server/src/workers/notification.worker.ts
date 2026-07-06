import { Worker, type Job } from "bullmq";
import { prisma, NotificationStatus } from "@ticketbox/database";
import {
  createRedisConnection,
  QUEUE_NAMES,
  type NotificationJobData,
} from "@ticketbox/queue";
import { sendEmail as sendSmtpEmail } from "../shared/mailer.js";

const MAX_ATTEMPTS = 3;

async function sendEmail(
  data: NotificationJobData,
  recipientEmail: string | null | undefined,
): Promise<void> {
  if (!recipientEmail) {
    throw new Error(
      `Cannot send EMAIL notification ${data.notification_id}: recipient email not found`,
    );
  }

  await sendSmtpEmail({
    to: recipientEmail,
    subject: data.subject ?? "TicketBox notification",
    text: data.body,
  });
}

async function sendPush(data: NotificationJobData): Promise<void> {
  console.log(
    `[notification:push] user=${data.recipient_user_id} body="${data.body.slice(0, 80)}"`,
  );
}

async function sendSms(data: NotificationJobData): Promise<void> {
  console.log(
    `[notification:sms] user=${data.recipient_user_id} body="${data.body.slice(0, 80)}"`,
  );
}

async function dispatchByChannel(
  data: NotificationJobData,
  recipientEmail?: string | null,
): Promise<void> {
  switch (data.channel) {
    case "EMAIL":
      return sendEmail(data, recipientEmail);
    case "APP":
    case "PUSH":
    case "IN_APP":
      return sendPush(data);
    default:
      return sendSms(data);
  }
}

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

export function createNotificationWorker(): Worker<NotificationJobData> {
  const worker = new Worker<NotificationJobData>(
    QUEUE_NAMES.NOTIFICATIONS,
    async (job: Job<NotificationJobData>) => {
      const { notification_id: notificationId } = job.data;
      const attemptNumber = (job.attemptsMade ?? 0) + 1;

      console.log(
        `[notification] Processing job=${job.id} notification=${notificationId} attempt=${attemptNumber}`,
      );

      const row = await prisma.notification.findUnique({
        where: { id: notificationId },
        select: {
          id: true,
          status: true,
          user: { select: { email: true } },
        },
      });

      if (!row) {
        console.warn(
          `[notification] Notification ${notificationId} not found, skipping`,
        );
        return;
      }

      if (row.status === NotificationStatus.SENT) {
        console.log(
          `[notification] Notification ${notificationId} already SENT, skipping`,
        );
        return;
      }

      if (row.status !== NotificationStatus.PENDING) {
        console.log(
          `[notification] Notification ${notificationId} is ${row.status}, skipping`,
        );
        return;
      }

      try {
        await dispatchByChannel(job.data, row.user?.email);
        await markSent(notificationId);
        console.log(
          `[notification] Job=${job.id} notification=${notificationId} SENT`,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const isFinalAttempt = attemptNumber >= MAX_ATTEMPTS;

        if (isFinalAttempt) {
          await markFailed(notificationId, msg);
          console.error(
            `[notification] Job=${job.id} notification=${notificationId} FAILED after retries: ${msg}`,
          );
        } else {
          await incrementAttempts(notificationId);
          console.warn(
            `[notification] Job=${job.id} notification=${notificationId} retrying (${attemptNumber}/${MAX_ATTEMPTS}): ${msg}`,
          );
          throw err;
        }
      }
    },
    {
      connection: createRedisConnection(),
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
