/**
 * guest-import.worker.ts — Worker import CSV danh sách khách VIP.
 * Sprint 1: stub chỉ log job data.
 * Sprint 4: parse CSV, validate từng row, upsert guest, ghi lỗi, cập nhật status PARTIAL/DONE.
 */

import { Worker, type Job } from "bullmq";
import { getRedisConnection, QUEUE_NAMES, type GuestImportJobData } from "@ticketbox/queue";

export function createGuestImportWorker(): Worker<GuestImportJobData> {
  const worker = new Worker<GuestImportJobData>(
    QUEUE_NAMES.GUEST_IMPORT,
    async (job: Job<GuestImportJobData>) => {
      console.log(`[guest-import] Processing job ${job.id}`, {
        job_id: job.data.job_id,
        concert_id: job.data.concert_id,
        csv_key: job.data.csv_object_key,
      });
      // TODO Sprint 4: implement CSV import
      // const stream = await storageClient.getObject(job.data.csv_object_key);
      // const rows = await parseCsv(stream);
      // for (const row of rows) {
      //   const { error } = validateGuestRow(row);
      //   if (error) { await guestImportErrorRepository.create(job.data.job_id, row, error); continue; }
      //   await guestListRepository.upsert(row);
      // }
      // await guestImportJobRepository.updateStatus(job.data.job_id, hasErrors ? "PARTIAL" : "DONE");
      console.log(`[guest-import] Job ${job.id} completed (stub)`);
    },
    { connection: getRedisConnection() }
  );

  worker.on("completed", (job) =>
    console.log(`[guest-import] Job ${job.id} succeeded`)
  );
  worker.on("failed", (job, err) =>
    console.error(`[guest-import] Job ${job?.id} failed:`, err.message)
  );

  return worker;
}
