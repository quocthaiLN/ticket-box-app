import { CheckinResult, DeviceStatus, GuestStatus, prisma, Prisma } from "@ticketbox/database";
import { enqueueGuestImportScan } from "@ticketbox/queue";
import { Errors } from "../../shared/http/problem-details.js";
import type {
  GuestImportErrorItem,
  GuestImportErrorsPage,
  GuestImportJobStatus,
  GuestImportTriggerResponse,
  GuestScanRequest,
  GuestScanResponse,
  GuestSearchQuery,
  GuestSummary
} from "./guest-list.types.js";

type GuestRow = {
  id: string;
  concertId: string;
  seatZoneId: string | null;
  fullName: string;
  phone: string;
  status: string;
};

type DeviceContext = {
  id: string;
  staffId: string;
  concertId: string;
  gateId: string;
};

export class GuestListRepository {
  // Enqueue job quét Drive cho 1 concert. Hệ thống tự nhập lúc 0h; đây là đường chạy
  // thủ công cho admin (test/chạy lại) — worker sẽ list file Drive và import.
  async triggerConcertImport(concertId: string): Promise<GuestImportTriggerResponse> {
    await this.assertConcertExists(concertId);
    const queueJobId = await enqueueGuestImportScan(concertId);
    return { concert_id: concertId, status: "SCAN_ENQUEUED", queue_job_id: queueJobId };
  }

  // Trạng thái 1 job import (số dòng thành công/lỗi, trạng thái cuối).
  async getImportJob(jobId: string): Promise<GuestImportJobStatus> {
    const job = await prisma.guestImportJob.findUnique({ where: { id: jobId } });
    if (!job) {
      throw Errors.guestImportJobNotFound(jobId);
    }
    return {
      id: job.id,
      concert_id: job.concertId,
      status: job.status,
      total_rows: job.totalRows,
      success_rows: job.successRows,
      error_rows: job.errorRows,
      skipped_rows: job.skippedRows,
      file_url: job.fileUrl,
      started_at: job.startedAt?.toISOString() ?? null,
      completed_at: job.completedAt?.toISOString() ?? null,
      error_message: job.errorMessage ?? null
    };
  }

  // Lỗi từng dòng của 1 job, phân trang theo cursor (id).
  async listImportErrors(
    jobId: string,
    limit: number,
    cursor?: string
  ): Promise<GuestImportErrorsPage> {
    const job = await prisma.guestImportJob.findUnique({
      where: { id: jobId },
      select: { id: true }
    });
    if (!job) {
      throw Errors.guestImportJobNotFound(jobId);
    }

    const rows = await prisma.guestImportError.findMany({
      where: { jobId },
      orderBy: [{ rowNumber: "asc" }, { id: "asc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
    });

    const hasMore = rows.length > limit;
    const items: GuestImportErrorItem[] = rows.slice(0, limit).map((error) => ({
      id: error.id,
      row_number: error.rowNumber,
      error_code: error.errorCode,
      error_message: error.errorMessage,
      raw_data: error.rawData
    }));

    return {
      items,
      next_cursor: hasMore ? items[items.length - 1].id : null,
      has_more: hasMore
    };
  }

  private async assertConcertExists(concertId: string) {
    const concert = await prisma.concert.findUnique({
      where: { id: concertId },
      select: { id: true }
    });

    if (!concert) {
      throw Errors.concertNotFound();
    }
  }

  // Tìm guest theo tên/số điện thoại và lọc theo zone được gate cho phép.
  async searchGuests(query: GuestSearchQuery): Promise<GuestSummary[]> {
    const allowedZoneIds = query.gate_id ? await this.getAllowedZoneIds(query.gate_id, query.concert_id) : undefined;
    const q = query.q ?? query.phone ?? query.name;

    const guests = await prisma.guestList.findMany({
      where: {
        concertId: query.concert_id,
        ...(query.zone_id ? { seatZoneId: query.zone_id } : {}),
        ...(allowedZoneIds ? { seatZoneId: { in: allowedZoneIds } } : {}),
        ...(q
          ? {
              OR: [
                { email: { contains: q, mode: "insensitive" } },
                { phone: { contains: q, mode: "insensitive" } },
                { fullName: { contains: q, mode: "insensitive" } }
              ]
            }
          : {})
      },
      orderBy: { fullName: "asc" },
      take: query.limit
    });

    return guests.map((guest) => ({
      guest_id: guest.id,
      concert_id: guest.concertId,
      full_name: guest.fullName,
      email: guest.email,
      phone_masked: guest.phone ? maskPhone(guest.phone) : undefined,
      zone_id: guest.seatZoneId ?? "",
      status: guest.status
    }));
  }

  // Check-in guest online, lock guest để tránh một khách vào cổng hai lần.
  async recordGuestScan(input: GuestScanRequest): Promise<GuestScanResponse> {
    const device = await this.getActiveDeviceContext(input.device_id, input.concert_id, input.gate_id);
    const scannedAt = input.scanned_at ? new Date(input.scanned_at) : new Date();

    return prisma.$transaction(
      async (tx) => {
        const guests = input.guest_id
          ? await tx.$queryRaw<GuestRow[]>(Prisma.sql`
              SELECT
                id AS "id",
                concert_id AS "concertId",
                seat_zone_id AS "seatZoneId",
                full_name AS "fullName",
                phone AS "phone",
                status::text AS "status"
              FROM guest_list
              WHERE id = ${input.guest_id}::uuid
              FOR UPDATE
            `)
          : await tx.$queryRaw<GuestRow[]>(Prisma.sql`
              SELECT
                id AS "id",
                concert_id AS "concertId",
                seat_zone_id AS "seatZoneId",
                full_name AS "fullName",
                phone AS "phone",
                status::text AS "status"
              FROM guest_list
              WHERE concert_id = ${input.concert_id}::uuid
                AND phone = ${input.phone ?? ""}
              FOR UPDATE
            `);

        const guest = guests[0];

        if (!guest) {
          const log = await tx.checkinLog.create({
            data: {
              concertId: input.concert_id,
              gateId: input.gate_id,
              deviceId: input.device_id,
              staffId: resolveStaffId(input.staff_user_id, device.staffId),
              result: CheckinResult.INVALID_GUEST,
              reason: "GUEST_NOT_FOUND",
              scannedAt,
              metadata: { source: "guest-online", phone_present: Boolean(input.phone) }
            },
            select: { id: true }
          });

          return {
            result: "INVALID_GUEST",
            gate_id: input.gate_id,
            device_id: input.device_id,
            log_id: log.id,
            reason: "GUEST_NOT_FOUND"
          };
        }

        if (guest.concertId !== input.concert_id) {
          const log = await this.createGuestLog(tx, input, device, guest, CheckinResult.WRONG_CONCERT, "WRONG_CONCERT", scannedAt);
          return toRejectedResponse("WRONG_CONCERT", input, guest, log.id, "WRONG_CONCERT");
        }

        if (!guest.seatZoneId || !(await this.gateAllowsZone(tx, input.gate_id, guest.seatZoneId, input.concert_id))) {
          const log = await this.createGuestLog(tx, input, device, guest, CheckinResult.WRONG_GATE, "GATE_ZONE_NOT_MAPPED", scannedAt);
          return toRejectedResponse("WRONG_GATE", input, guest, log.id, "GATE_ZONE_NOT_MAPPED");
        }

        if (guest.status === GuestStatus.CHECKED_IN) {
          const log = await this.createGuestLog(tx, input, device, guest, CheckinResult.ALREADY_CHECKED_IN, "GUEST_ALREADY_CHECKED_IN", scannedAt);
          return toRejectedResponse("ALREADY_CHECKED_IN", input, guest, log.id, "GUEST_ALREADY_CHECKED_IN");
        }

        if (guest.status === GuestStatus.CANCELLED) {
          const log = await this.createGuestLog(tx, input, device, guest, CheckinResult.INVALID_GUEST, "GUEST_CANCELLED", scannedAt);
          return toRejectedResponse("GUEST_CANCELLED", input, guest, log.id, "GUEST_CANCELLED");
        }

        const updated = await tx.guestList.update({
          where: { id: guest.id },
          data: {
            status: GuestStatus.CHECKED_IN,
            checkedInAt: scannedAt,
            checkedInById: resolveStaffId(input.staff_user_id, device.staffId)
          }
        });

        const log = await this.createGuestLog(tx, input, device, guest, CheckinResult.SUCCESS, undefined, scannedAt);

        return {
          result: "SUCCESS",
          guest_id: updated.id,
          gate_id: input.gate_id,
          device_id: input.device_id,
          zone_id: updated.seatZoneId,
          checked_in_at: updated.checkedInAt?.toISOString() ?? scannedAt.toISOString(),
          log_id: log.id
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }

  // Lấy danh sách zone mà một gate được phép nhận guest.
  private async getAllowedZoneIds(gateId: string, concertId: string) {
    const mappings = await prisma.checkinGateZone.findMany({
      where: {
        gateId,
        concertId,
        gate: { isActive: true }
      },
      select: { seatZoneId: true }
    });

    return mappings.map((mapping) => mapping.seatZoneId);
  }

  // Kiểm tra thiết bị check-in đang active và thuộc đúng concert/gate.
  private async getActiveDeviceContext(deviceId: string, concertId: string, gateId: string): Promise<DeviceContext> {
    const device = await prisma.checkinDevice.findFirst({
      where: {
        id: deviceId,
        concertId,
        gateId,
        status: DeviceStatus.ACTIVE,
        gate: { isActive: true }
      },
      select: { id: true, staffId: true, concertId: true, gateId: true }
    });

    if (!device) {
      throw Errors.deviceNotAssigned();
    }

    return device;
  }

  // Kiểm tra gate có mapping hợp lệ với zone của guest hay không.
  private async gateAllowsZone(tx: Prisma.TransactionClient, gateId: string, seatZoneId: string, concertId: string) {
    const mapping = await tx.checkinGateZone.findUnique({
      where: { gateId_seatZoneId: { gateId, seatZoneId } },
      select: {
        concertId: true,
        gate: { select: { isActive: true, concertId: true } },
        seatZone: { select: { concertId: true } }
      }
    });

    return Boolean(
      mapping &&
        mapping.concertId === concertId &&
        mapping.gate.concertId === concertId &&
        mapping.seatZone.concertId === concertId &&
        mapping.gate.isActive
    );
  }

  // Ghi log cho mọi lượt scan guest, bao gồm cả thành công và bị từ chối.
  private createGuestLog(
    tx: Prisma.TransactionClient,
    input: GuestScanRequest,
    device: DeviceContext,
    guest: GuestRow,
    result: CheckinResult,
    reason: string | undefined,
    scannedAt: Date
  ) {
    return tx.checkinLog.create({
      data: {
        guestId: guest.id,
        concertId: input.concert_id,
        seatZoneId: guest.seatZoneId,
        gateId: input.gate_id,
        deviceId: input.device_id,
        staffId: resolveStaffId(input.staff_user_id, device.staffId),
        result,
        reason,
        scannedAt,
        metadata: { source: "guest-online" }
      },
      select: { id: true }
    });
  }
}

// Tạo response chuẩn cho các trường hợp guest scan bị từ chối.
function toRejectedResponse(
  result: GuestScanResponse["result"],
  input: GuestScanRequest,
  guest: GuestRow,
  logId: string,
  reason: string
): GuestScanResponse {
  return {
    result,
    guest_id: guest.id,
    gate_id: input.gate_id,
    device_id: input.device_id,
    zone_id: guest.seatZoneId,
    log_id: logId,
    reason
  };
}

// Chọn staff check-in, ưu tiên staff từ request nếu hợp lệ.
function resolveStaffId(inputStaffId: string | undefined, deviceStaffId: string) {
  return inputStaffId && isUuid(inputStaffId) ? inputStaffId : deviceStaffId;
}

// Che bớt số điện thoại guest khi trả dữ liệu ra ngoài.
function maskPhone(phone: string) {
  if (phone.length <= 3) return "***";
  return `${"*".repeat(Math.max(phone.length - 3, 0))}${phone.slice(-3)}`;
}

// Kiểm tra chuỗi có đúng định dạng UUID hay không.
function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
