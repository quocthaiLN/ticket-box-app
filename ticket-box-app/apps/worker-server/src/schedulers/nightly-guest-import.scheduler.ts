import type { Queue } from "bullmq";
import { prisma } from "@ticketbox/database";
import { enqueueGuestImport } from "@ticketbox/queue";
import { listConcertCsvFiles } from "@ticketbox/storage";

const SCHEDULE_ID = "nightly-guest-import";
const TIMEZONE = "Asia/Ho_Chi_Minh";

/**
 * Đăng ký lịch quét Drive chạy đúng 0h (giờ Việt Nam) mỗi ngày.
 * BullMQ sinh job tên "scan-drive-folders" theo cron; worker guest-import xử lý.
 */
export async function registerNightlyGuestImportSchedule(
  queue: Queue,
): Promise<void> {
  await queue.upsertJobScheduler(
    SCHEDULE_ID,
    { pattern: "11 23 * * *", tz: TIMEZONE },
    { name: "scan-drive-folders", data: {} },
  );
  console.log(
    `[nightly-guest-import] Scheduled at 0h ${TIMEZONE} (cron "11 23 * * *")`,
  );
}

/**
 * Quét thư mục Drive của concert rồi tạo + enqueue guest-import job cho từng file CSV.
 * - concertId rỗng: quét mọi concert PUBLISHED diễn ra trong 24h tới (lịch 0h).
 * - concertId có: chỉ quét concert đó (admin trigger thủ công để test/chạy lại).
 */
export async function scanAndEnqueueGuestImports(
  concertId?: string,
): Promise<{ concerts: number; enqueued: number; skipped: number }> {
  const concerts = await findConcertsToScan(concertId);
  let enqueued = 0;
  let skipped = 0;

  for (const concert of concerts) {
    if (!concert.guestDriveFolderId) continue;

    const files = await listConcertCsvFiles(concert.guestDriveFolderId);
    for (const file of files) {
      // Khử trùng: đã có job (chưa FAILED) cho đúng file Drive này thì bỏ qua.
      const existing = await prisma.guestImportJob.findFirst({
        where: {
          concertId: concert.id,
          fileUrl: file.id,
          status: { not: "FAILED" },
        },
        select: { id: true },
      });
      if (existing) {
        skipped += 1;
        continue;
      }

      const job = await prisma.guestImportJob.create({
        data: {
          concertId: concert.id,
          uploadedById: concert.organizerId,
          fileUrl: file.id,
          status: "PENDING",
        },
      });

      await enqueueGuestImport({
        job_id: job.id,
        concert_id: concert.id,
        csv_object_key: file.id,
        uploaded_by_user_id: concert.organizerId,
      });
      enqueued += 1;
    }
  }

  console.log(
    `[nightly-guest-import] scan done — concerts=${concerts.length} enqueued=${enqueued} skipped=${skipped}`,
  );
  return { concerts: concerts.length, enqueued, skipped };
}

/** Concert cần quét: theo id (thủ công) hoặc các concert PUBLISHED diễn ra trong 24h tới. */
function findConcertsToScan(concertId?: string) {
  if (concertId) {
    // Trigger thủ công của admin: nhập cho concert này bất kể trạng thái (miễn đã gán folder).
    return prisma.concert.findMany({
      where: { id: concertId, guestDriveFolderId: { not: null } },
      select: { id: true, organizerId: true, guestDriveFolderId: true },
    });
  }

  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 3_600_000);
  return prisma.concert.findMany({
    where: {
      status: "PUBLISHED",
      guestDriveFolderId: { not: null },
      startsAt: { gte: now, lt: in24h },
    },
    select: { id: true, organizerId: true, guestDriveFolderId: true },
  });
}
