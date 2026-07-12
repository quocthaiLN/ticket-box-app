import { randomBytes } from "node:crypto";
import { Worker, type Job } from "bullmq";
import { prisma, Prisma, type GuestImportJob } from "@ticketbox/database";
import {
  createRedisConnection,
  enqueueEmail,
  QUEUE_NAMES,
  type GuestImportJobData,
  type GuestImportScanData,
} from "@ticketbox/queue";
import { downloadDriveFile } from "@ticketbox/storage";
import { scanAndEnqueueGuestImports } from "../schedulers/nightly-guest-import.scheduler.js";
import { buildGuestInviteEmail } from "../shared/guest-invite-email.js";

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
        email: string;
        phone?: string;
        code?: string;
        note?: string;
      };
    }
  | { ok: false; error: RowError };

type ImportStats = {
  totalRows: number;
  successRows: number;
  errorRows: number;
  skippedRows: number;
};

export function createGuestImportWorker(): Worker<GuestImportJobData | GuestImportScanData> {
  const worker = new Worker<GuestImportJobData | GuestImportScanData>(
    QUEUE_NAMES.GUEST_IMPORT,
    async (job: Job<GuestImportJobData | GuestImportScanData>) => {
      // Job quét Drive (scheduler 0h hoặc trigger thủ công) → sinh các import job.
      if (job.name === "scan-drive-folders") {
        const { concert_id } = job.data as GuestImportScanData;
        return scanAndEnqueueGuestImports(concert_id);
      }

      // Job import 1 file CSV.
      const result = await processGuestImportJob(job.data as GuestImportJobData);
      console.log("[guest-import] done", {
        job_id: (job.data as GuestImportJobData).job_id,
        total_rows: result.totalRows,
        success_rows: result.successRows,
        error_rows: result.errorRows,
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
    data: { status: "PROCESSING", startedAt: new Date(), errorMessage: null },
  });

  try {
    // Tải CSV từ Google Drive (fileUrl = Drive file id).
    const csv = await downloadDriveFile(job.fileUrl);
    const rows = parseCsv(csv);

    // Mọi khách mời được gán vào khu khách mời (zone code = "GUEST") — tự tạo nếu thiếu.
    const guestZoneId = await resolveGuestZoneId(job.concertId);
    const stats = await importRows(job, rows, guestZoneId);
    await syncGuestZoneCapacity(job.concertId, guestZoneId);

    // Gửi email mời (QR mã mời + ảnh sơ đồ) cho khách chưa từng được gửi.
    // Lỗi gửi lẻ không làm fail job import — email.worker tự retry theo backoff.
    await sendPendingInviteEmails(job.concertId);

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
      data: { status: "FAILED", completedAt: new Date(), errorMessage: message },
    });
    throw error;
  }
}

async function importRows(
  job: GuestImportJob,
  rows: CsvRow[],
  guestZoneId: string,
): Promise<ImportStats> {
  let successRows = 0;
  const errors: RowError[] = [];

  for (const row of rows) {
    const validation = validateGuestRow(job, row);
    if (!validation.ok) {
      errors.push(validation.error);
      continue;
    }

    const guest = validation.guest;
    // Khử trùng theo (concertId, email): import lại email cũ chỉ cập nhật, không tạo trùng.
    // Mã mời = "vé" của khách (QR check-in): CSV không có code → tự sinh; update không
    // ghi đè code bằng undefined để không vô hiệu QR đã gửi.
    await prisma.guestList.upsert({
      where: {
        concertId_email: { concertId: job.concertId, email: guest.email },
      },
      update: {
        fullName: guest.fullName,
        phone: guest.phone,
        ...(guest.code ? { code: guest.code } : {}),
        note: guest.note,
        seatZoneId: guestZoneId,
        importJobId: job.id,
        status: "INVITED",
      },
      create: {
        concertId: job.concertId,
        email: guest.email,
        fullName: guest.fullName,
        phone: guest.phone,
        code: guest.code ?? generateGuestCode(),
        note: guest.note,
        seatZoneId: guestZoneId,
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
    skippedRows: 0,
  };
}

function validateGuestRow(job: GuestImportJob, row: CsvRow): GuestRowValidation {
  const raw = row.raw;
  const fullName = clean(raw.full_name ?? raw.name ?? raw.fullName);
  const email = normalizeEmail(raw.email);
  const rowConcertId = clean(raw.concert_id);

  if (rowConcertId && rowConcertId !== job.concertId) {
    return rowError(row, "WRONG_CONCERT", "Row concert_id does not match the import job concert.");
  }
  if (!fullName) {
    return rowError(row, "FULL_NAME_REQUIRED", "full_name is required.");
  }
  if (!email) {
    return rowError(row, "EMAIL_REQUIRED", "email is required.");
  }

  return {
    ok: true,
    guest: {
      fullName,
      email,
      phone: normalizePhone(raw.phone ?? raw.phone_number ?? raw.mobile),
      code: clean(raw.code ?? raw.guest_code),
      note: clean(raw.note),
    },
  };
}

/** Khu khách mời = seat zone code "GUEST". Tự tạo nếu concert chưa có để import luôn chạy được. */
async function resolveGuestZoneId(concertId: string): Promise<string> {
  const zone = await prisma.seatZone.upsert({
    where: { concertId_code: { concertId, code: "GUEST" } },
    update: {},
    create: {
      concertId,
      code: "GUEST",
      name: "Khu khách mời",
      description: "Khu vực dành cho khách mời (tự tạo khi nhập guest list).",
      // Sức chứa thật = số khách mời import được, đồng bộ lại sau mỗi lần import.
      capacity: 0,
      sortOrder: 99,
    },
    select: { id: true },
  });
  return zone.id;
}

/**
 * Capacity khu GUEST = số khách mời hiện hành của concert (import là upsert theo
 * email nên phải đếm lại từ DB, không cộng dồn successRows giữa các lần import).
 */
async function syncGuestZoneCapacity(concertId: string, guestZoneId: string): Promise<void> {
  const guestCount = await prisma.guestList.count({
    where: { concertId, status: { not: "CANCELLED" } },
  });
  await prisma.seatZone.update({
    where: { id: guestZoneId },
    data: { capacity: guestCount },
  });
}

/** Mã mời tự sinh: GUEST-XXXXXXXXXX (unique theo concert nhờ constraint DB). */
function generateGuestCode(): string {
  return `GUEST-${randomBytes(5).toString("hex").toUpperCase()}`;
}

/**
 * Gửi email mời cho mọi guest INVITED của concert chưa có invite_email_sent_at.
 * Đánh dấu đã gửi NGAY SAU khi enqueue thành công (email.worker retry phần SMTP)
 * → re-import/scheduler chạy lại không gửi trùng.
 */
export async function sendPendingInviteEmails(concertId: string): Promise<void> {
  const concert = await prisma.concert.findUnique({
    where: { id: concertId },
    select: {
      title: true,
      startsAt: true,
      seatMapImageUrl: true,
      venue: { select: { name: true, address: true } },
    },
  });
  if (!concert) return;

  const guests = await prisma.guestList.findMany({
    where: { concertId, status: "INVITED", inviteEmailSentAt: null },
    select: { id: true, fullName: true, email: true, code: true },
  });
  if (guests.length === 0) return;

  let sent = 0;
  for (const guest of guests) {
    try {
      // Guest cũ (trước khi bắt buộc có code) → bổ sung code trước khi gửi QR.
      let code = guest.code;
      if (!code) {
        code = generateGuestCode();
        await prisma.guestList.update({
          where: { id: guest.id },
          data: { code },
        });
      }

      const email = await buildGuestInviteEmail(
        { fullName: guest.fullName, email: guest.email, code },
        {
          id: concertId,
          title: concert.title,
          venueName: concert.venue.name,
          venueAddress: concert.venue.address,
          startsAt: concert.startsAt,
          seatMapImageUrl: concert.seatMapImageUrl,
        },
      );
      await enqueueEmail(email);
      await prisma.guestList.update({
        where: { id: guest.id },
        data: { inviteEmailSentAt: new Date() },
      });
      sent += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(
        `[guest-import] invite email failed for guest=${guest.id} (${guest.email}): ${message}`,
      );
    }
  }

  console.log(
    `[guest-import] invite emails enqueued: ${sent}/${guests.length} (concert=${concertId})`,
  );
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
  if (!headers.includes("email")) {
    throw new Error("CSV header must include email.");
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

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function clean(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function normalizeEmail(value: unknown) {
  const email = clean(value);
  if (!email) return undefined;
  const lowered = email.toLowerCase();
  // Kiểm tra định dạng email tối thiểu để tránh ghi danh tính rác.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lowered) ? lowered : undefined;
}

function normalizePhone(value: unknown) {
  const phone = clean(value);
  if (!phone) return undefined;
  const normalized = phone.replace(/[^\d+]/g, "");
  return normalized.length >= 8 ? normalized : undefined;
}

function rowError(row: CsvRow, code: string, message: string): { ok: false; error: RowError } {
  return { ok: false, error: { rowNumber: row.rowNumber, rawData: row.raw, code, message } };
}
