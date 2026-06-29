import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Worker, type Job } from "bullmq";
import {
  prisma,
  Prisma,
  type GuestImportJob,
  type SeatZone,
} from "@ticketbox/database";
import {
  createRedisConnection,
  QUEUE_NAMES,
  type GuestImportJobData,
} from "@ticketbox/queue";

type CsvRow = {
  rowNumber: number;
  raw: Record<string, string>;
};

type RowError = {
  rowNumber: number;
  rawData: Record<string, string>;
  code: string;
  message: string;
};

type GuestRowValidation =
  | {
      ok: true;
      guest: {
        fullName: string;
        phone: string;
        email?: string;
        code?: string;
        note?: string;
        seatZoneId?: string;
        skipReason?: string;
      };
    }
  | { ok: false; error: RowError };

type ImportStats = {
  totalRows: number;
  successRows: number;
  errorRows: number;
  skippedRows: number;
};

export function createGuestImportWorker(): Worker<GuestImportJobData> {
  const worker = new Worker<GuestImportJobData>(
    QUEUE_NAMES.GUEST_IMPORT,
    async (job: Job<GuestImportJobData>) => {
      const result = await processGuestImportJob(job.data);
      console.log("[guest-import] done", {
        job_id: job.data.job_id,
        total_rows: result.totalRows,
        success_rows: result.successRows,
        error_rows: result.errorRows,
        skipped_rows: result.skippedRows,
      });
      return result;
    },
    { connection: createRedisConnection() },
  );

  worker.on("completed", (job) =>
    console.log(`[guest-import] Job ${job.id} succeeded`),
  );
  worker.on("failed", (job, err) =>
    console.error(`[guest-import] Job ${job?.id} failed:`, err.message),
  );

  return worker;
}

async function processGuestImportJob(
  data: GuestImportJobData,
): Promise<ImportStats> {
  const job = await prisma.guestImportJob.findUnique({
    where: { id: data.job_id },
  });

  if (!job) {
    throw new Error(`Guest import job ${data.job_id} was not found.`);
  }

  await prisma.guestImportJob.update({
    where: { id: job.id },
    data: {
      status: "PROCESSING",
      startedAt: new Date(),
      errorMessage: null,
    },
  });

  try {
    const csv = await readTextSource(job.fileUrl || data.csv_object_key);
    const rows = parseCsv(csv);
    const stats = await importRows(job, rows);
    const finalStatus = stats.errorRows > 0 ? "PARTIAL" : "DONE";

    await prisma.guestImportJob.update({
      where: { id: job.id },
      data: {
        status: finalStatus,
        totalRows: stats.totalRows,
        successRows: stats.successRows,
        errorRows: stats.errorRows,
        skippedRows: stats.skippedRows,
        completedAt: new Date(),
        errorMessage: null,
      },
    });

    return stats;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.guestImportJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        errorMessage: message,
      },
    });
    throw error;
  }
}

async function importRows(
  job: GuestImportJob,
  rows: CsvRow[],
): Promise<ImportStats> {
  const zoneCache = new Map<string, Pick<SeatZone, "id" | "code"> | null>();
  let successRows = 0;
  let skippedRows = 0;
  const errors: RowError[] = [];

  for (const row of rows) {
    const validation = await validateGuestRow(job, row, zoneCache);

    if (!validation.ok) {
      errors.push(validation.error);
      continue;
    }

    const guest = validation.guest;

    if (guest.skipReason) {
      skippedRows += 1;
      continue;
    }

    await prisma.guestList.upsert({
      where: {
        concertId_phone: {
          concertId: job.concertId,
          phone: guest.phone,
        },
      },
      update: {
        fullName: guest.fullName,
        email: guest.email,
        code: guest.code,
        note: guest.note,
        seatZoneId: guest.seatZoneId,
        importJobId: job.id,
        status: "INVITED",
      },
      create: {
        concertId: job.concertId,
        fullName: guest.fullName,
        phone: guest.phone,
        email: guest.email,
        code: guest.code,
        note: guest.note,
        seatZoneId: guest.seatZoneId,
        importJobId: job.id,
        status: "INVITED",
      },
    });

    successRows += 1;
  }

  if (errors.length > 0) {
    await prisma.guestImportError.createMany({
      data: errors.map((error) => ({
        jobId: job.id,
        rowNumber: error.rowNumber,
        rawData: error.rawData as Prisma.InputJsonValue,
        errorCode: error.code,
        errorMessage: error.message,
      })),
      skipDuplicates: true,
    });
  }

  return {
    totalRows: rows.length,
    successRows,
    errorRows: errors.length,
    skippedRows,
  };
}

async function validateGuestRow(
  job: GuestImportJob,
  row: CsvRow,
  zoneCache: Map<string, Pick<SeatZone, "id" | "code"> | null>,
): Promise<GuestRowValidation> {
  const raw = row.raw;
  const fullName = clean(raw.full_name ?? raw.name ?? raw.fullName);
  const phone = normalizePhone(raw.phone ?? raw.phone_number ?? raw.mobile);
  const rowConcertId = clean(raw.concert_id);

  if (rowConcertId && rowConcertId !== job.concertId) {
    return rowError(row, "WRONG_CONCERT", "Row concert_id does not match the import job concert.");
  }

  if (!fullName) {
    return rowError(row, "FULL_NAME_REQUIRED", "full_name is required.");
  }

  if (!phone) {
    return rowError(row, "PHONE_REQUIRED", "phone is required.");
  }

  const seatZoneId = await resolveSeatZoneId(job.concertId, raw, zoneCache);
  if (seatZoneId === false) {
    return rowError(row, "SEAT_ZONE_NOT_FOUND", "seat_zone_id or zone does not belong to this concert.");
  }

  return {
    ok: true,
    guest: {
      fullName,
      phone,
      email: clean(raw.email),
      code: clean(raw.code ?? raw.guest_code),
      note: clean(raw.note),
      seatZoneId: seatZoneId ?? undefined,
    },
  };
}

async function resolveSeatZoneId(
  concertId: string,
  raw: Record<string, string>,
  cache: Map<string, Pick<SeatZone, "id" | "code"> | null>,
) {
  const explicitId = clean(raw.seat_zone_id ?? raw.zone_id);
  if (explicitId) {
    const cacheKey = `id:${explicitId}`;
    if (!cache.has(cacheKey)) {
      cache.set(
        cacheKey,
        await prisma.seatZone.findUnique({
          where: { id_concertId: { id: explicitId, concertId } },
          select: { id: true, code: true },
        }),
      );
    }
    return cache.get(cacheKey)?.id ?? false;
  }

  const zoneCode = clean(raw.zone ?? raw.zone_code)?.toUpperCase();
  if (!zoneCode) return null;

  const cacheKey = `code:${zoneCode}`;
  if (!cache.has(cacheKey)) {
    cache.set(
      cacheKey,
      await prisma.seatZone.findUnique({
        where: { concertId_code: { concertId, code: zoneCode } },
        select: { id: true, code: true },
      }),
    );
  }

  return cache.get(cacheKey)?.id ?? false;
}

function parseCsv(input: string): CsvRow[] {
  const records = parseCsvRecords(input);
  if (records.length < 2) {
    throw new Error("CSV must contain a header row and at least one data row.");
  }

  const headers = records[0].map((header) => normalizeHeader(header));
  if (!headers.includes("full_name") && !headers.includes("name")) {
    throw new Error("CSV header must include full_name.");
  }
  if (!headers.includes("phone")) {
    throw new Error("CSV header must include phone.");
  }

  return records.slice(1).map((record, index) => {
    const raw: Record<string, string> = {};
    headers.forEach((header, headerIndex) => {
      raw[header] = record[headerIndex]?.trim() ?? "";
    });
    return { rowNumber: index + 2, raw };
  });
}

function parseCsvRecords(input: string): string[][] {
  const records: string[][] = [];
  let current = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    const next = input[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(current);
      if (row.some((cell) => cell.trim().length > 0)) records.push(row);
      row = [];
      current = "";
      continue;
    }

    current += char;
  }

  if (inQuotes) {
    throw new Error("CSV contains an unterminated quoted field.");
  }

  row.push(current);
  if (row.some((cell) => cell.trim().length > 0)) records.push(row);

  return records;
}

async function readTextSource(source: string): Promise<string> {
  const resolved = resolveLocalPath(source);
  if (!resolved) {
    throw new Error(`CSV source is not readable locally: ${source}`);
  }
  return readFile(resolved, "utf8");
}

function resolveLocalPath(source: string): string | undefined {
  const trimmed = source.trim();
  const candidates: string[] = [];

  if (trimmed.startsWith("file://")) {
    candidates.push(fileURLToPath(trimmed));
  } else if (path.isAbsolute(trimmed)) {
    candidates.push(trimmed);
  } else if (trimmed.startsWith("s3://")) {
    const withoutScheme = trimmed.replace(/^s3:\/\/[^/]+\//, "");
    candidates.push(...localObjectCandidates(withoutScheme));
  } else if (!/^https?:\/\//i.test(trimmed)) {
    candidates.push(...localObjectCandidates(trimmed));
  }

  return candidates.find((candidate) => existsSync(candidate));
}

function localObjectCandidates(objectKey: string) {
  const roots = [
    process.env.STORAGE_LOCAL_ROOT,
    process.env.STORAGE_IMPORT_ROOT,
    process.cwd(),
    path.resolve(process.cwd(), "storage"),
    path.resolve(process.cwd(), "uploads"),
  ].filter(Boolean) as string[];

  return roots.map((root) => path.resolve(root, objectKey));
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function clean(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function normalizePhone(value: unknown) {
  const phone = clean(value);
  if (!phone) return undefined;
  const normalized = phone.replace(/[^\d+]/g, "");
  return normalized.length >= 8 ? normalized : undefined;
}

function rowError(row: CsvRow, code: string, message: string): { ok: false; error: RowError } {
  return {
    ok: false,
    error: {
      rowNumber: row.rowNumber,
      rawData: row.raw,
      code,
      message,
    },
  };
}
