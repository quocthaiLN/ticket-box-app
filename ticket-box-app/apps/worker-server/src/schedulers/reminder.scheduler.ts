/**
 * reminder.scheduler.ts — Scheduler nhắc lịch trước concert.
 * Sprint 1: stub placeholder. Sprint 4: enqueue notification job trước N giờ concert.
 *
 * Cách dùng dự kiến (Sprint 4):
 *   Chạy recurring mỗi 15 phút, query concerts có start_time trong khoảng [now+23h, now+25h],
 *   enqueue notification cho user đã mua vé concert đó.
 */

import type { Queue } from "bullmq";

export type ReminderSchedulerOptions = {
  /** Gửi reminder trước concert bao nhiêu giờ (default 24) */
  hours_before?: number;
  /** Khoảng thời gian chạy scheduler (ms) — default 15 phút */
  interval_ms?: number;
};

/**
 * Khởi tạo scheduler nhắc lịch.
 * Sprint 1: chỉ log, chưa query DB hay enqueue job thật.
 */
export function startReminderScheduler(
  _notificationQueue: Queue,
  options: ReminderSchedulerOptions = {}
): NodeJS.Timeout {
  const hoursBefore = options.hours_before ?? 24;
  const intervalMs = options.interval_ms ?? 15 * 60 * 1000; // 15 phút

  console.log(
    `[reminder-scheduler] Started — checking every ${intervalMs / 60000}m for concerts in ${hoursBefore}h (stub)`
  );

  const timer = setInterval(() => {
    console.log(`[reminder-scheduler] Tick — checking upcoming concerts (stub)`);
    // TODO Sprint 4: implement scheduler logic
    // const cutoffStart = new Date(Date.now() + (hoursBefore - 1) * 3600_000);
    // const cutoffEnd   = new Date(Date.now() + (hoursBefore + 1) * 3600_000);
    // const concerts = await concertRepository.findByStartTimeBetween(cutoffStart, cutoffEnd);
    // for (const c of concerts) { await enqueueReminders(notificationQueue, c); }
  }, intervalMs);

  return timer;
}
