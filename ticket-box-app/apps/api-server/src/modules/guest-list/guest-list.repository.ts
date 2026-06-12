import { CheckinResult, DeviceStatus, GuestStatus, prisma, Prisma } from "@ticketbox/database";
import { enqueueGuestImport } from "@ticketbox/queue";
import { ApiError } from "../../shared/http/problem-details.js";
import type {
  GuestImportRequest,
  GuestImportResponse,
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
  // Tạo job import guest và đẩy CSV sang worker xử lý nền.
  async createImportJob(input: GuestImportRequest): Promise<GuestImportResponse> {
    const fileUrl = input.file_url ?? input.file_object_key;

    if (!fileUrl) {
      throw new ApiError({
        title: "INVALID_CSV",
        status: 400,
        code: "INVALID_CSV",
        detail: "file_object_key or file_url is required to create a guest import job."
      });
    }

    if (!input.uploaded_by_user_id) {
      throw new ApiError({
        title: "UNAUTHORIZED",
        status: 401,
        code: "UNAUTHORIZED",
        detail: "Authenticated user is required to create a guest import job."
      });
    }

    await this.assertConcertExists(input.concert_id);

    const importJob = await prisma.guestImportJob.create({
      data: {
        concertId: input.concert_id,
        uploadedById: input.uploaded_by_user_id,
        fileUrl,
        status: "PENDING"
      }
    });

    try {
      const queueJobId = await enqueueGuestImport({
        job_id: importJob.id,
        concert_id: input.concert_id,
        csv_object_key: fileUrl,
        uploaded_by_user_id: input.uploaded_by_user_id
      });

      return {
        job_id: importJob.id,
        concert_id: input.concert_id,
        status: "PENDING",
        file_url: fileUrl,
        queue_job_id: queueJobId,
        dry_run: input.dry_run
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await prisma.guestImportJob.update({
        where: { id: importJob.id },
        data: {
          status: "FAILED",
          errorMessage: `Failed to enqueue guest import job: ${message}`,
          completedAt: new Date()
        }
      });

      return {
        job_id: importJob.id,
        concert_id: input.concert_id,
        status: "FAILED",
        file_url: fileUrl,
        dry_run: input.dry_run,
        error_message: message
      };
    }
  }

  private async assertConcertExists(concertId: string) {
    const concert = await prisma.concert.findUnique({
      where: { id: concertId },
      select: { id: true }
    });

    if (!concert) {
      throw new ApiError({
        title: "CONCERT_NOT_FOUND",
        status: 404,
        code: "CONCERT_NOT_FOUND",
        detail: "Concert was not found."
      });
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
      phone_masked: maskPhone(guest.phone),
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
      throw new ApiError({
        title: "DEVICE_NOT_ASSIGNED",
        status: 422,
        code: "DEVICE_NOT_ASSIGNED",
        detail: "Device is not active or is not assigned to this concert/gate."
      });
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
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
