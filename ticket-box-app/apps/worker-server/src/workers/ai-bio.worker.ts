import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Worker, type Job } from "bullmq";
import { prisma } from "@ticketbox/database";
import {
  createRedisConnection,
  QUEUE_NAMES,
  type AiBioJobData,
} from "@ticketbox/queue";

export function createAiBioWorker(): Worker<AiBioJobData> {
  const worker = new Worker<AiBioJobData>(
    QUEUE_NAMES.AI_BIO,
    async (job: Job<AiBioJobData>) => {
      const result = await processAiBioJob(job.data);
      console.log("[ai-bio] done", {
        job_id: job.data.job_id,
        concert_id: job.data.concert_id,
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

async function processAiBioJob(data: AiBioJobData) {
  const bioJob = await prisma.artistBioJob.findUnique({
    where: { id: data.job_id },
    include: {
      concert: {
        select: {
          id: true,
          title: true,
          artistName: true,
        },
      },
    },
  });

  if (!bioJob) {
    throw new Error(`Artist bio job ${data.job_id} was not found.`);
  }

  await prisma.artistBioJob.update({
    where: { id: bioJob.id },
    data: {
      status: "PROCESSING",
      errorMessage: null,
    },
  });

  try {
    const extractedText = cleanExtractedText(
      data.source_text ??
        bioJob.extractedText ??
        (await readOptionalTextSource(bioJob.sourceFileUrl)),
    );

    if (!extractedText) {
      throw new Error(
        "Could not extract usable text from the artist bio source file.",
      );
    }

    const artistName = data.artist_name || bioJob.concert.artistName;
    const generatedBio = generateMockArtistBio({
      artistName,
      concertTitle: bioJob.concert.title,
      sourceText: extractedText,
    });

    await prisma.$transaction([
      prisma.artistBioJob.update({
        where: { id: bioJob.id },
        data: {
          status: "DONE",
          extractedText,
          generatedBio,
          errorMessage: null,
        },
      }),
      prisma.concert.update({
        where: { id: bioJob.concertId },
        data: { artistBio: generatedBio },
      }),
    ]);

    return { generatedBio };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.artistBioJob.update({
      where: { id: bioJob.id },
      data: {
        status: "FAILED",
        errorMessage: message,
      },
    });
    throw error;
  }
}

function cleanExtractedText(value: string | undefined) {
  if (!value) return undefined;
  const cleaned = value.replace(/\0/g, " ").replace(/\s+/g, " ").trim();
  return cleaned.length >= 20 ? cleaned.slice(0, 6_000) : undefined;
}

function generateMockArtistBio(input: {
  artistName: string;
  concertTitle: string;
  sourceText: string;
}) {
  const firstSentence = input.sourceText
    .split(/(?<=[.!?])\s+/)
    .find((sentence) => sentence.length >= 30)
    ?.trim();
  const sourceSummary = firstSentence ?? input.sourceText.slice(0, 180).trim();

  return [
    `${input.artistName} brings a focused, emotionally rich performance to ${input.concertTitle}.`,
    sourceSummary,
    "This AI-assisted bio was generated from the uploaded press material and is ready for organizer review.",
  ].join(" ");
}

async function readOptionalTextSource(
  source: string,
): Promise<string | undefined> {
  const resolved = resolveLocalPath(source);
  if (!resolved) {
    return undefined;
  }

  const buffer = await readFile(resolved);
  return buffer.toString("utf8");
}

function resolveLocalPath(source: string): string | undefined {
  const trimmed = source.trim();
  const candidates: string[] = [];

  if (trimmed.startsWith("file://")) {
    candidates.push(fileURLToPath(trimmed));
  } else if (path.isAbsolute(trimmed)) {
    candidates.push(trimmed);
  } else if (trimmed.startsWith("s3://")) {
    const objectKey = trimmed.replace(/^s3:\/\/[^/]+\//, "");
    candidates.push(...localObjectCandidates(objectKey));
  } else if (!/^https?:\/\//i.test(trimmed)) {
    candidates.push(...localObjectCandidates(trimmed));
  }

  return candidates.find((candidate) => existsSync(candidate));
}

function localObjectCandidates(objectKey: string) {
  const roots = [
    process.env.STORAGE_LOCAL_ROOT,
    process.env.STORAGE_PRESS_KIT_ROOT,
    process.cwd(),
    path.resolve(process.cwd(), "storage"),
    path.resolve(process.cwd(), "uploads"),
  ].filter(Boolean) as string[];

  return roots.map((root) => path.resolve(root, objectKey));
}
