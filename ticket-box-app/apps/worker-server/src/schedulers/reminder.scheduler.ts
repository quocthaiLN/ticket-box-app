import type { Queue } from "bullmq";
import { prisma } from "@ticketbox/database";

export type ReminderSchedulerOptions = {
  /** Gửi reminder trước concert bao nhiêu giờ (default 24) */
  hours_before?: number;
  /** Khoảng thời gian chạy scheduler (ms) — default 15 phút */
  interval_ms?: number;
};

/**
 * Khởi tạo scheduler nhắc lịch trước concert.
 * Chạy mỗi 15 phút, query concerts bắt đầu trong [now+23h, now+25h],
 * enqueue notification PENDING cho user đang giữ vé hợp lệ.
 * Mỗi cặp (ticket, loại CONCERT_REMINDER) chỉ được gửi 1 lần nhờ
 * kiểm tra xem notification đã tồn tại hay chưa.
 */
export function startReminderScheduler(
  notificationQueue: Queue,
  options: ReminderSchedulerOptions = {},
): NodeJS.Timeout {
  const hoursBefore = options.hours_before ?? 24;
  const intervalMs = options.interval_ms ?? 15 * 60 * 1000;

  console.log(
    `[reminder-scheduler] Started — checking every ${intervalMs / 60000}m for concerts starting in ~${hoursBefore}h`,
  );

  const tick = async () => {
    try {
      const windowStart = new Date(
        Date.now() + (hoursBefore - 1) * 3_600_000,
      );
      const windowEnd = new Date(Date.now() + (hoursBefore + 1) * 3_600_000);

      // Tìm concerts bắt đầu trong cửa sổ [now+23h, now+25h]
      const upcomingConcerts = await prisma.$queryRaw<
        Array<{ id: string; title: string }>
      >`
        SELECT id, title
        FROM concerts
        WHERE status = 'PUBLISHED'
          AND starts_at >= ${windowStart}
          AND starts_at < ${windowEnd}
      `;

      if (upcomingConcerts.length === 0) return;

      console.log(
        `[reminder-scheduler] Found ${upcomingConcerts.length} upcoming concert(s) for reminder`,
      );

      for (const concert of upcomingConcerts) {
        await sendRemindersForConcert(notificationQueue, concert);
      }
    } catch (err) {
      console.error("[reminder-scheduler] Tick error:", err);
    }
  };

  const timer = setInterval(() => void tick(), intervalMs);
  return timer;
}

async function sendRemindersForConcert(
  notificationQueue: Queue,
  concert: { id: string; title: string },
): Promise<void> {
  // Lấy user_id của các ticket ISSUED thuộc concert này
  const ticketHolders = await prisma.$queryRaw<
    Array<{ ticketId: string; userId: string }>
  >`
    SELECT t.id AS "ticketId", t.user_id AS "userId"
    FROM tickets t
    WHERE t.concert_id = ${concert.id}::uuid
      AND t.status = 'ISSUED'
  `;

  if (ticketHolders.length === 0) return;

  let enqueued = 0;
  let skipped = 0;

  for (const holder of ticketHolders) {
    // Kiểm tra đã có notification CONCERT_REMINDER cho ticket này chưa.
    const existing = await prisma.notification.findFirst({
      where: {
        ticketId: holder.ticketId,
        type: "CONCERT_REMINDER" as never,
        concertId: concert.id,
      },
      select: { id: true },
    });

    if (existing) {
      skipped++;
      continue;
    }

    // Tạo notification PENDING trong DB
    const notification = await prisma.notification.create({
      data: {
        userId: holder.userId,
        concertId: concert.id,
        ticketId: holder.ticketId,
        channel: "EMAIL",
        type: "CONCERT_REMINDER" as never,
        payload: {
          concert_id: concert.id,
          concert_title: concert.title,
          ticket_id: holder.ticketId,
          body: `Reminder: "${concert.title}" starts in about 24 hours. Don't forget your QR ticket!`,
          subject: `Reminder: ${concert.title} is tomorrow!`,
        },
      },
    });

    // Enqueue BullMQ job
    try {
      await notificationQueue.add(
        "send-notification",
        {
          notification_id: notification.id,
          channel: "EMAIL",
          recipient_user_id: holder.userId,
          subject: `Reminder: ${concert.title} is tomorrow!`,
          body: `Reminder: "${concert.title}" starts in about 24 hours. Don't forget your QR ticket!`,
        },
        {
          attempts: 3,
          backoff: { type: "exponential", delay: 5_000 },
          removeOnComplete: { count: 100 },
          removeOnFail: { count: 50 },
        },
      );
      enqueued++;
    } catch (err) {
      console.error(
        `[reminder-scheduler] Failed to enqueue for ticket ${holder.ticketId}:`,
        err,
      );
    }
  }

  console.log(
    `[reminder-scheduler] Concert "${concert.title}": enqueued=${enqueued} skipped=${skipped}`,
  );
}
