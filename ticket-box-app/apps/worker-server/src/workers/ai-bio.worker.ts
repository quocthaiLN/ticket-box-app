/**
 * ai-bio.worker.ts — Worker gọi AI để tạo artist bio cho concert.
 * Sprint 1: stub chỉ log job data.
 * Sprint 4: call AI adapter (mock/real), lưu generated_bio, cập nhật status DONE/FAILED.
 */

import { Worker, type Job } from "bullmq";
import { getRedisConnection, QUEUE_NAMES, type AiBioJobData } from "@ticketbox/queue";

export function createAiBioWorker(): Worker<AiBioJobData> {
  const worker = new Worker<AiBioJobData>(
    QUEUE_NAMES.AI_BIO,
    async (job: Job<AiBioJobData>) => {
      console.log(`[ai-bio] Processing job ${job.id}`, {
        job_id: job.data.job_id,
        concert_id: job.data.concert_id,
        artist: job.data.artist_name,
      });
      // TODO Sprint 4: implement AI bio generation
      // const bio = await aiAdapter.generateBio(job.data.artist_name, job.data.source_text);
      // await artistBioRepository.updateJobDone(job.data.job_id, bio);
      // await concertRepository.updateArtistBio(job.data.concert_id, bio);
      console.log(`[ai-bio] Job ${job.id} completed (stub)`);
    },
    { connection: getRedisConnection() }
  );

  worker.on("completed", (job) =>
    console.log(`[ai-bio] Job ${job.id} succeeded`)
  );
  worker.on("failed", (job, err) =>
    console.error(`[ai-bio] Job ${job?.id} failed:`, err.message)
  );

  return worker;
}
