import { Worker, type Job } from "bullmq";
import { prisma } from "@ticketbox/database";
import {
  createRedisConnection,
  QUEUE_NAMES,
  type AiBioJobData,
} from "@ticketbox/queue";
import { cacheDelete, cacheDeletePattern } from "@ticketbox/redis";
import { downloadPressKit } from "@ticketbox/storage";
import { generateArtistBio } from "./ai-bio.client.js";

export function createAiBioWorker(): Worker<AiBioJobData> {
  const worker = new Worker<AiBioJobData>(
    QUEUE_NAMES.AI_BIO,
    async (job: Job<AiBioJobData>) => {
      const result = await processAiBioJob(job.data);
      console.log("[ai-bio] done", {
        job_id: job.data.job_id,
        concert_id: job.data.concert_id,
        organizer_request_id: job.data.organizer_request_id,
        generated_chars: result.generatedBio.length,
      });
      return result;
    },
    { connection: createRedisConnection() },
  );

  worker.on("completed", (job) =>
    console.log(`[ai-bio] Job ${job.id} succeeded`),
  );
  worker.on("failed", (job, err) =>
    console.error(`[ai-bio] Job ${job?.id} failed:`, err.message),
  );

  return worker;
}

// Bio có thể gắn vào concert (luồng cũ) hoặc organizer request (luồng nộp hồ sơ).
type BioTarget = {
  kind: "concert" | "request";
  id: string;
  title: string;
  artistName: string;
};

async function processAiBioJob(data: AiBioJobData) {
  const bioJob = await prisma.artistBioJob.findUnique({
    where: { id: data.job_id },
    include: {
      concert: { select: { id: true, title: true, artistName: true } },
      organizerRequest: { select: { id: true, title: true, artistName: true } },
    },
  });
  if (!bioJob) throw new Error(`Artist bio job ${data.job_id} không tồn tại.`);

  // Ưu tiên concert; nếu chưa có concert thì ghi vào organizer request.
  const target: BioTarget | null = bioJob.concert
    ? { kind: "concert", id: bioJob.concert.id, title: bioJob.concert.title, artistName: bioJob.concert.artistName }
    : bioJob.organizerRequest
      ? { kind: "request", id: bioJob.organizerRequest.id, title: bioJob.organizerRequest.title, artistName: bioJob.organizerRequest.artistName }
      : null;
  if (!target) {
    throw new Error(`Bio job ${bioJob.id} không gắn concert lẫn organizer request.`);
  }

  await markProcessing(bioJob.id, target);

  try {
    // Tách nội dung (PDF) + làm sạch văn bản; cho phép truyền source_text để demo nhanh.
    const extractedText = cleanExtractedText(
      data.source_text ?? bioJob.extractedText ?? (await readSource(bioJob.sourceFileUrl)),
    );
    if (!extractedText) {
      throw new Error("Không tách được nội dung từ file press kit.");
    }

    const { bio: generatedBio, model } = await generateArtistBio({
      artistName: data.artist_name || target.artistName,
      eventTitle: target.title,
      sourceText: extractedText,
    });

    await persistDone(bioJob.id, bioJob.requestedById, target, extractedText, generatedBio, model);
    return { generatedBio };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await markFailed(bioJob.id, target, message);
    throw error; // ném lại để BullMQ retry theo policy (attempts: 5)
  }
}

async function markProcessing(jobId: string, target: BioTarget) {
  await prisma.artistBioJob.update({
    where: { id: jobId },
    data: { status: "PROCESSING", errorMessage: null },
  });
  if (target.kind === "request") {
    await prisma.organizerRequest.update({
      where: { id: target.id },
      data: { bioStatus: "PROCESSING" },
    });
  }
}

async function persistDone(
  jobId: string,
  requestedById: string | null,
  target: BioTarget,
  extractedText: string,
  generatedBio: string,
  model: string,
) {
  const jobUpdate = prisma.artistBioJob.update({
    where: { id: jobId },
    data: {
      status: "DONE",
      extractedText,
      generatedBio,
      modelName: model,
      completedAt: new Date(),
      errorMessage: null,
    },
  });

  if (target.kind === "concert") {
    // Luồng cũ: ghi thẳng vào concert + audit + invalidate cache để hiển thị ngay.
    await prisma.$transaction([
      jobUpdate,
      prisma.concert.update({ where: { id: target.id }, data: { artistBio: generatedBio } }),
      prisma.auditLog.create({
        data: {
          actorUserId: requestedById,
          action: "PUBLISH_ARTIST_BIO",
          entityType: "concert",
          entityId: target.id,
          metadata: { job_id: jobId, source: "ai-worker" },
        },
      }),
    ]);
    await invalidateConcertCache(target.id);
  } else {
    // Luồng hồ sơ: ghi vào request; bio sẽ vào concert lúc admin approve.
    await prisma.$transaction([
      jobUpdate,
      prisma.organizerRequest.update({
        where: { id: target.id },
        data: { artistBio: generatedBio, bioStatus: "DONE" },
      }),
    ]);
  }
}

async function markFailed(jobId: string, target: BioTarget, message: string) {
  await prisma.artistBioJob.update({
    where: { id: jobId },
    data: { status: "FAILED", errorMessage: message },
  });
  if (target.kind === "request") {
    await prisma.organizerRequest
      .update({ where: { id: target.id }, data: { bioStatus: "FAILED" } })
      .catch(() => {});
  }
}

// Tải file press kit từ Supabase (object path) hoặc URL http rồi tách text PDF.
async function readSource(source: string): Promise<string | undefined> {
  const ref = source.trim();
  if (!ref) return undefined;

  const buffer = /^https?:\/\//i.test(ref)
    ? Buffer.from(await (await fetch(ref)).arrayBuffer())
    : await downloadPressKit(ref);

  // pdf-parse v2: dùng class PDFParse (Buffer tự convert sang Uint8Array).
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  try {
    const { text } = await parser.getText();
    return text;
  } finally {
    await parser.destroy();
  }
}

// Làm sạch văn bản trích từ PDF: nối từ ngắt dòng, bỏ số trang, gom khoảng trắng.
function cleanExtractedText(value: string | undefined) {
  if (!value) return undefined;
  const cleaned = value
    .replace(/\0/g, " ")
    .replace(/-\n/g, "")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/^\s*\d+\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return cleaned.length >= 20 ? cleaned : undefined;
}

async function invalidateConcertCache(concertId: string) {
  await Promise.allSettled([
    cacheDelete(`catalog:concert:${concertId}`),
    cacheDelete(`catalog:metadata:${concertId}`),
    cacheDeletePattern("catalog:list:*"),
  ]);
}
