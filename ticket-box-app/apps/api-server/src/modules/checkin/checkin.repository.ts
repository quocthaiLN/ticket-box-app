import { createHmac, randomUUID } from "node:crypto";
import {
  checkInTicketAtGate,
  CheckinResult,
  DeviceStatus,
  GateZoneValidationError,
  prisma,
  Prisma,
  TicketStatus,
} from "@ticketbox/database";
import { env } from "@ticketbox/config";
import type {
  CheckinPreloadQuery,
  CheckinPreloadResponse,
  CheckinScanRequest,
  CheckinScanResponse,
  CreateDeviceRequest,
  CreateGateRequest,
  CreateGateZoneMappingRequest,
  DeviceDto,
  GateDto,
  GateZoneMappingDto,
  OfflineBatchRequest,
  OfflineBatchResponse,
  OfflineSyncRequest,
  OfflineSyncResponse,
  ReplaceGateZonesRequest,
  UpdateDeviceRequest,
  UpdateGateRequest,
} from "./checkin.types.js";
import { processOfflineSyncBatch } from "./checkin.sync.js";
import { Errors } from "../../shared/http/problem-details.js";

type DeviceContext = {
  id: string;
  staffId: string;
  concertId: string;
  gateId: string;
  status: string;
};

type QrInput = {
  tokenHash?: string;
  payload?: Record<string, unknown>;
  signature?: string;
  invalidReason?: string;
};

type QueryOptions = {
  concert_id?: string;
  gate_id?: string;
  limit: number;
};

export class CheckinRepository {
  // Quét vé online, kiểm tra QR/device/gate và trả kết quả check-in cho checker.
  async recordOnlineScan(
    input: CheckinScanRequest,
  ): Promise<CheckinScanResponse> {
    const device = await this.getActiveDeviceContext(
      input.device_id,
      input.concert_id,
      input.gate_id,
    );
    const qr = this.resolveQrInput(input);
    const scannedAt = input.scanned_at
      ? new Date(input.scanned_at)
      : new Date();

    if (!qr.tokenHash || qr.invalidReason) {
      const logId = await this.createRejectedTicketLog({
        input,
        device,
        result: CheckinResult.INVALID_TICKET,
        reason: qr.invalidReason ?? "QR_TOKEN_MISSING",
        scanTokenHash: qr.tokenHash,
        scannedAt,
      });

      return {
        result: "INVALID_TICKET",
        gate_id: input.gate_id,
        device_id: input.device_id,
        log_id: logId,
        reason: qr.invalidReason ?? "QR_TOKEN_MISSING",
      };
    }

    try {
      const ticket = await checkInTicketAtGate({
        concertId: input.concert_id,
        deviceId: input.device_id,
        gateId: input.gate_id,
        qrTokenHash: qr.tokenHash,
        staffId: this.resolveStaffId(input, device),
        scannedAt,
        metadata: {
          source: "online",
          qr_payload_present: Boolean(qr.payload),
        } as Prisma.InputJsonValue,
      });

      const log = await prisma.checkinLog.findFirst({
        where: {
          ticketId: ticket.id,
          result: CheckinResult.SUCCESS,
          scannedAt,
        },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });

      return {
        result: "SUCCESS",
        ticket_id: ticket.id,
        gate_id: input.gate_id,
        device_id: input.device_id,
        zone_id: ticket.seatZoneId,
        checked_in_at:
          ticket.checkedInAt?.toISOString() ?? scannedAt.toISOString(),
        log_id: log?.id,
      };
    } catch (error) {
      if (error instanceof GateZoneValidationError) {
        const mapped = this.mapTicketScanError(error.code);
        const log = await prisma.checkinLog.findFirst({
          where: {
            scanTokenHash: qr.tokenHash,
            concertId: input.concert_id,
            result: mapped.logResult,
          },
          orderBy: { createdAt: "desc" },
          select: { id: true, ticketId: true, seatZoneId: true },
        });

        return {
          result: mapped.result,
          ticket_id: log?.ticketId ?? undefined,
          gate_id: input.gate_id,
          device_id: input.device_id,
          zone_id: log?.seatZoneId ?? undefined,
          log_id: log?.id,
          reason: error.code,
        };
      }

      throw error;
    }
  }

  // Tải snapshot dữ liệu hợp lệ cho thiết bị trước khi check-in hoặc chạy offline.
  async getPreloadSnapshot(
    query: CheckinPreloadQuery,
  ): Promise<CheckinPreloadResponse> {
    const device = await prisma.checkinDevice.findFirst({
      where: {
        id: query.device_id,
        concertId: query.concert_id,
        gateId: query.gate_id,
        status: DeviceStatus.ACTIVE,
      },
      include: {
        concert: { select: { id: true, title: true, startsAt: true } },
        gate: { select: { id: true, code: true, name: true, isActive: true } },
      },
    });

    if (!device || !device.gate.isActive) {
      throw Errors.deviceNotAssigned();
    }

    const allowedZones = await prisma.checkinGateZone.findMany({
      where: {
        gateId: query.gate_id,
        concertId: query.concert_id,
        gate: { isActive: true },
      },
      include: {
        seatZone: { select: { id: true, code: true, name: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    const allowedZoneIds = allowedZones.map((mapping) => mapping.seatZoneId);

    const tickets = await prisma.ticket.findMany({
      where: {
        concertId: query.concert_id,
        seatZoneId: { in: allowedZoneIds },
        status: TicketStatus.ISSUED,
      },
      select: {
        id: true,
        qrTokenHash: true,
        qrSignature: true,
        concertId: true,
        seatZoneId: true,
        status: true,
      },
      orderBy: { issuedAt: "asc" },
      take: query.limit,
    });

    const guests = query.include_guests
      ? await prisma.guestList.findMany({
          where: {
            concertId: query.concert_id,
            seatZoneId: { in: allowedZoneIds },
            status: "INVITED",
          },
          select: {
            id: true,
            concertId: true,
            seatZoneId: true,
            fullName: true,
            phone: true,
            status: true,
          },
          orderBy: { fullName: "asc" },
          take: query.limit,
        })
      : [];

    await prisma.checkinDevice.update({
      where: { id: device.id },
      data: { lastSeenAt: new Date() },
    });

    return {
      snapshot_id: `snap_${randomUUID()}`,
      concert_id: query.concert_id,
      gate_id: query.gate_id,
      device_id: query.device_id,
      generated_at: new Date().toISOString(),
      device: {
        id: device.id,
        device_code: device.deviceCode,
        name: device.name,
        status: device.status,
        last_seen_at: device.lastSeenAt?.toISOString() ?? null,
      },
      gate: {
        id: device.gate.id,
        code: device.gate.code,
        name: device.gate.name,
        is_active: device.gate.isActive,
      },
      concert: {
        id: device.concert.id,
        title: device.concert.title,
        starts_at: device.concert.startsAt.toISOString(),
      },
      allowed_zone_ids: allowedZoneIds,
      allowed_seat_zones: allowedZones.map((mapping) => ({
        id: mapping.seatZone.id,
        code: mapping.seatZone.code,
        name: mapping.seatZone.name,
      })),
      tickets: tickets.map((ticket) => ({
        ticket_id: ticket.id,
        qr_payload_hash: ticket.qrTokenHash,
        qr_signature: ticket.qrSignature,
        concert_id: ticket.concertId,
        zone_id: ticket.seatZoneId,
        status_snapshot: "ISSUED",
      })),
      guests: guests.map((guest) => ({
        guest_id: guest.id,
        concert_id: guest.concertId,
        zone_id: guest.seatZoneId ?? "",
        full_name: guest.fullName,
        phone_masked: maskPhone(guest.phone),
        status_snapshot: guest.status,
      })),
      offline: {
        qr_signature_supported: true,
        full_offline_sync_ready: true,
        notes: ["Sprint 4 offline batch sync is enabled."],
      },
    };
  }

  // Lấy danh sách cổng check-in theo concert/gate để phục vụ admin.
  async listGates(options: QueryOptions): Promise<GateDto[]> {
    const rows = await prisma.checkinGate.findMany({
      where: {
        concertId: options.concert_id,
        ...(options.gate_id ? { id: options.gate_id } : {}),
      },
      include: {
        gateZones: {
          include: {
            seatZone: { select: { id: true, code: true, name: true } },
          },
        },
      },
      orderBy: [{ concertId: "asc" }, { sortOrder: "asc" }],
      take: options.limit,
    });

    return rows.map(toGateDto);
  }

  // Lấy chi tiết một cổng check-in kèm danh sách zone được mapping.
  async getGate(gateId: string): Promise<GateDto> {
    const gate = await prisma.checkinGate.findUnique({
      where: { id: gateId },
      include: {
        gateZones: {
          include: {
            seatZone: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });

    if (!gate) throw Errors.gateNotFound();
    return toGateDto(gate);
  }

  // Tạo cổng check-in mới cho concert.
  async createGate(input: CreateGateRequest): Promise<GateDto> {
    await this.assertConcertExists(input.concert_id);
    const gate = await prisma.checkinGate.create({
      data: {
        concertId: input.concert_id,
        code: input.code,
        name: input.name,
        description: input.description,
        isActive: input.is_active,
        sortOrder: input.sort_order,
      },
      include: { gateZones: { include: { seatZone: true } } },
    });

    return toGateDto(gate);
  }

  // Cập nhật thông tin cổng check-in như tên, mã, trạng thái hoạt động.
  async updateGate(gateId: string, input: UpdateGateRequest): Promise<GateDto> {
    await this.getGate(gateId);
    const gate = await prisma.checkinGate.update({
      where: { id: gateId },
      data: {
        code: input.code,
        name: input.name,
        description: input.description,
        isActive: input.is_active,
        sortOrder: input.sort_order,
      },
      include: { gateZones: { include: { seatZone: true } } },
    });

    return toGateDto(gate);
  }

  // Vô hiệu hoá cổng bằng soft delete để vẫn giữ lịch sử/log liên quan.
  async deleteGate(gateId: string): Promise<GateDto> {
    await this.getGate(gateId);
    const gate = await prisma.checkinGate.update({
      where: { id: gateId },
      data: { isActive: false },
      include: { gateZones: { include: { seatZone: true } } },
    });
    return toGateDto(gate);
  }

  // Lấy danh sách thiết bị check-in theo concert hoặc gate.
  async listDevices(options: QueryOptions): Promise<DeviceDto[]> {
    const rows = await prisma.checkinDevice.findMany({
      where: {
        concertId: options.concert_id,
        gateId: options.gate_id,
      },
      orderBy: [{ concertId: "asc" }, { createdAt: "desc" }],
      take: options.limit,
    });

    return rows.map(toDeviceDto);
  }

  // Đăng ký thiết bị check-in và gán thiết bị vào staff/concert/gate.
  async createDevice(input: CreateDeviceRequest): Promise<DeviceDto> {
    await this.assertGateBelongsToConcert(input.gate_id, input.concert_id);
    const device = await prisma.checkinDevice.create({
      data: {
        deviceCode: input.device_code,
        staffId: input.staff_id,
        concertId: input.concert_id,
        gateId: input.gate_id,
        name: input.name,
      },
    });

    return toDeviceDto(device);
  }

  // Cập nhật thiết bị check-in, bao gồm đổi gate, tên hoặc trạng thái.
  async updateDevice(
    deviceId: string,
    input: UpdateDeviceRequest,
  ): Promise<DeviceDto> {
    const current = await prisma.checkinDevice.findUnique({
      where: { id: deviceId },
    });
    if (!current)
      throw Errors.deviceNotFound();

    const targetGateId = input.gate_id ?? current.gateId;
    await this.assertGateBelongsToConcert(targetGateId, current.concertId);

    const device = await prisma.checkinDevice.update({
      where: { id: deviceId },
      data: {
        deviceCode: input.device_code,
        staffId: input.staff_id,
        gateId: input.gate_id,
        name: input.name,
        status: input.status,
      },
    });

    return toDeviceDto(device);
  }

  // Thu hồi thiết bị bằng trạng thái REVOKED thay vì xoá cứng.
  async deleteDevice(deviceId: string): Promise<DeviceDto> {
    const current = await prisma.checkinDevice.findUnique({
      where: { id: deviceId },
    });
    if (!current)
      throw Errors.deviceNotFound();

    const device = await prisma.checkinDevice.update({
      where: { id: deviceId },
      data: { status: DeviceStatus.REVOKED },
    });

    return toDeviceDto(device);
  }

  // Lấy danh sách mapping giữa cổng và khu vé được phép vào.
  async listGateZoneMappings(
    options: QueryOptions,
  ): Promise<GateZoneMappingDto[]> {
    const rows = await prisma.checkinGateZone.findMany({
      where: {
        concertId: options.concert_id,
        gateId: options.gate_id,
      },
      orderBy: { createdAt: "desc" },
      take: options.limit,
    });

    return rows.map(toMappingDto);
  }

  // Tạo mapping cổng-khu vé, dùng upsert để gọi lại không tạo trùng.
  async createGateZoneMapping(
    input: CreateGateZoneMappingRequest,
  ): Promise<GateZoneMappingDto> {
    const gate = await prisma.checkinGate.findUnique({
      where: { id: input.gate_id },
    });
    if (!gate) throw Errors.gateNotFound();
    await this.assertZoneBelongsToConcert(input.seat_zone_id, gate.concertId);

    const mapping = await prisma.checkinGateZone.upsert({
      where: {
        gateId_seatZoneId: {
          gateId: input.gate_id,
          seatZoneId: input.seat_zone_id,
        },
      },
      update: {},
      create: {
        gateId: input.gate_id,
        seatZoneId: input.seat_zone_id,
        concertId: gate.concertId,
      },
    });

    return toMappingDto(mapping);
  }

  // Thay toàn bộ danh sách zone được phép của một cổng trong một transaction.
  async replaceGateZones(
    gateId: string,
    input: ReplaceGateZonesRequest,
  ): Promise<GateZoneMappingDto[]> {
    const gate = await prisma.checkinGate.findUnique({ where: { id: gateId } });
    if (!gate) throw Errors.gateNotFound();

    for (const zoneId of input.seat_zone_ids) {
      await this.assertZoneBelongsToConcert(zoneId, gate.concertId);
    }

    const mappings = await prisma.$transaction(async (tx) => {
      await tx.checkinGateZone.deleteMany({ where: { gateId } });

      if (input.seat_zone_ids.length === 0) {
        return [];
      }

      await tx.checkinGateZone.createMany({
        data: input.seat_zone_ids.map((seatZoneId) => ({
          gateId,
          seatZoneId,
          concertId: gate.concertId,
        })),
        skipDuplicates: true,
      });

      return tx.checkinGateZone.findMany({
        where: { gateId },
        orderBy: { createdAt: "asc" },
      });
    });

    return mappings.map(toMappingDto);
  }

  // Xoá một mapping cổng-khu vé theo id dạng gate_id:seat_zone_id.
  async deleteGateZoneMapping(mappingId: string): Promise<GateZoneMappingDto> {
    const [gateId, seatZoneId] = mappingId.split(":");
    if (!gateId || !seatZoneId) {
      throw Errors.invalidMappingId();
    }

    const existing = await prisma.checkinGateZone.findUnique({
      where: { gateId_seatZoneId: { gateId, seatZoneId } },
    });
    if (!existing) throw Errors.gateMappingNotFound();

    await prisma.checkinGateZone.delete({
      where: { gateId_seatZoneId: { gateId, seatZoneId } },
    });

    return toMappingDto(existing);
  }

  // Xử lý batch sync offline và trả kết quả từng item.
  async recordOfflineSyncBatch(
    input: OfflineSyncRequest,
  ): Promise<OfflineSyncResponse> {
    return processOfflineSyncBatch(input);
  }

  // Tạo batch sync offline idempotent theo batch token.
  async createOfflineBatch(
    input: OfflineBatchRequest,
  ): Promise<OfflineBatchResponse> {
    const device = await this.getActiveDeviceContext(
      input.device_id,
      input.concert_id,
      input.gate_id,
    );
    const existing = await prisma.offlineCheckinBatch.findUnique({
      where: { batchToken: input.batch_id },
    });

    if (existing) {
      return {
        batch_id: existing.batchToken,
        concert_id: existing.concertId,
        device_id: existing.deviceId,
        gate_id: existing.gateId,
        status: existing.status,
      };
    }

    const batch = await prisma.offlineCheckinBatch.create({
      data: {
        batchToken: input.batch_id,
        concertId: input.concert_id,
        gateId: input.gate_id,
        deviceId: input.device_id,
        staffId: device.staffId,
      },
    });

    return {
      batch_id: batch.batchToken,
      concert_id: batch.concertId,
      device_id: batch.deviceId,
      gate_id: batch.gateId,
      status: batch.status,
    };
  }

  // Chuẩn hoá nhiều dạng QR input thành token hash/payload/signature dùng chung.
  private resolveQrInput(input: CheckinScanRequest): QrInput {
    const payload = normalizePayload(input.qr_payload);
    const rawPayloadToken =
      typeof input.qr_payload === "string" && !payload
        ? input.qr_payload.trim()
        : undefined;
    const tokenHash =
      input.qr_payload_hash ??
      input.qr_token ??
      input.ticket_code ??
      rawPayloadToken ??
      asString(payload?.qr_token) ??
      asString(payload?.qrToken);
    const signature =
      input.qr_signature ??
      asString(payload?.qr_signature) ??
      asString(payload?.qrSignature);

    if (payload && signature && !verifyQrSignature(payload, signature)) {
      return {
        tokenHash,
        payload,
        signature,
        invalidReason: "QR_SIGNATURE_INVALID",
      };
    }

    return { tokenHash, payload, signature };
  }

  // Kiểm tra thiết bị đang active và đúng concert/gate trước khi cho scan.
  private async getActiveDeviceContext(
    deviceId: string,
    concertId: string,
    gateId: string,
  ): Promise<DeviceContext> {
    const device = await prisma.checkinDevice.findFirst({
      where: {
        id: deviceId,
        concertId,
        gateId,
        status: DeviceStatus.ACTIVE,
        gate: { isActive: true },
      },
      select: {
        id: true,
        staffId: true,
        concertId: true,
        gateId: true,
        status: true,
      },
    });

    if (!device) {
      throw Errors.deviceNotAssigned();
    }

    return device;
  }

  // Chọn staff thực hiện scan, ưu tiên staff từ request nếu là UUID hợp lệ.
  private resolveStaffId(input: CheckinScanRequest, device: DeviceContext) {
    return input.staff_user_id && isUuid(input.staff_user_id)
      ? input.staff_user_id
      : device.staffId;
  }

  // Ghi log cho lượt scan vé bị từ chối để vẫn có audit trail.
  private async createRejectedTicketLog(args: {
    input: CheckinScanRequest;
    device: DeviceContext;
    result: CheckinResult;
    reason: string;
    scanTokenHash?: string;
    scannedAt: Date;
  }) {
    const log = await prisma.checkinLog.create({
      data: {
        concertId: args.input.concert_id,
        gateId: args.input.gate_id,
        deviceId: args.input.device_id,
        staffId: this.resolveStaffId(args.input, args.device),
        scanTokenHash: args.scanTokenHash,
        result: args.result,
        reason: args.reason,
        scannedAt: args.scannedAt,
        metadata: { source: "online" },
      },
      select: { id: true },
    });

    return log.id;
  }

  // Chuyển lỗi domain từ database helper thành result trả về cho checker.
  private mapTicketScanError(code: string): {
    result: CheckinScanResponse["result"];
    logResult: CheckinResult;
  } {
    if (
      code === "GATE_ZONE_NOT_MAPPED" ||
      code === "GATE_INACTIVE" ||
      code === "GATE_CONCERT_MISMATCH"
    ) {
      return { result: "WRONG_GATE", logResult: CheckinResult.WRONG_GATE };
    }
    if (code === "TICKET_ALREADY_CHECKED_IN") {
      return {
        result: "ALREADY_CHECKED_IN",
        logResult: CheckinResult.ALREADY_CHECKED_IN,
      };
    }
    if (code === "WRONG_CONCERT") {
      return {
        result: "WRONG_CONCERT",
        logResult: CheckinResult.WRONG_CONCERT,
      };
    }
    if (code === "TICKET_NOT_CHECKIN_READY") {
      return {
        result: "EXPIRED_OR_CANCELLED",
        logResult: CheckinResult.INVALID_TICKET,
      };
    }

    return {
      result: "INVALID_TICKET",
      logResult: CheckinResult.INVALID_TICKET,
    };
  }

  // Đảm bảo concert tồn tại trước khi tạo tài nguyên check-in.
  private async assertConcertExists(concertId: string) {
    const concert = await prisma.concert.findUnique({
      where: { id: concertId },
      select: { id: true },
    });
    if (!concert)
      throw Errors.concertNotFound();
  }

  // Đảm bảo gate thuộc đúng concert đang thao tác.
  private async assertGateBelongsToConcert(gateId: string, concertId: string) {
    const gate = await prisma.checkinGate.findUnique({
      where: { id_concertId: { id: gateId, concertId } },
      select: { id: true },
    });
    if (!gate)
      throw Errors.gateNotFound("Gate was not found for this concert.");
  }

  // Đảm bảo seat zone thuộc đúng concert đang cấu hình.
  private async assertZoneBelongsToConcert(
    seatZoneId: string,
    concertId: string,
  ) {
    const zone = await prisma.seatZone.findUnique({
      where: { id_concertId: { id: seatZoneId, concertId } },
      select: { id: true },
    });
    if (!zone)
      throw Errors.seatZoneNotFoundForConcert();
  }
}

// Parse QR payload JSON nếu client gửi payload dạng chuỗi.
function normalizePayload(value: unknown): Record<string, unknown> | undefined {
  if (!value) return undefined;
  if (typeof value === "object" && !Array.isArray(value))
    return value as Record<string, unknown>;
  if (typeof value !== "string") return undefined;

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

// Verify chữ ký QR bằng HMAC để phát hiện payload bị chỉnh sửa.
function verifyQrSignature(
  payload: Record<string, unknown>,
  signature: string,
) {
  const payloadWithoutSignature = { ...payload };
  delete payloadWithoutSignature["qr_signature"];
  delete payloadWithoutSignature["qrSignature"];
  const sorted = Object.fromEntries(
    Object.keys(payloadWithoutSignature)
      .sort()
      .map((key) => [key, payloadWithoutSignature[key]]),
  );
  const canonical = JSON.stringify(sorted);
  const expected = createHmac("sha256", env.qr.signingSecret)
    .update(canonical, "utf8")
    .digest("base64");
  return expected === signature;
}

// Chuyển Prisma gate model sang DTO trả về API.
function toGateDto(gate: {
  id: string;
  concertId: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  gateZones?: Array<{ seatZone: { id: string; code: string; name: string } }>;
}): GateDto {
  return {
    id: gate.id,
    concert_id: gate.concertId,
    code: gate.code,
    name: gate.name,
    description: gate.description,
    is_active: gate.isActive,
    sort_order: gate.sortOrder,
    created_at: gate.createdAt.toISOString(),
    updated_at: gate.updatedAt.toISOString(),
    zones: gate.gateZones?.map((mapping) => ({
      id: mapping.seatZone.id,
      code: mapping.seatZone.code,
      name: mapping.seatZone.name,
    })),
  };
}

// Chuyển Prisma device model sang DTO trả về API.
function toDeviceDto(device: {
  id: string;
  deviceCode: string;
  staffId: string;
  concertId: string;
  gateId: string;
  name: string | null;
  status: string;
  lastSeenAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): DeviceDto {
  return {
    id: device.id,
    device_code: device.deviceCode,
    staff_id: device.staffId,
    concert_id: device.concertId,
    gate_id: device.gateId,
    name: device.name,
    status: device.status,
    last_seen_at: device.lastSeenAt?.toISOString() ?? null,
    created_at: device.createdAt.toISOString(),
    updated_at: device.updatedAt.toISOString(),
  };
}

// Chuyển mapping gate-zone sang DTO có id tổng hợp.
function toMappingDto(mapping: {
  gateId: string;
  seatZoneId: string;
  concertId: string;
  createdAt: Date;
}): GateZoneMappingDto {
  return {
    id: `${mapping.gateId}:${mapping.seatZoneId}`,
    gate_id: mapping.gateId,
    seat_zone_id: mapping.seatZoneId,
    concert_id: mapping.concertId,
    created_at: mapping.createdAt.toISOString(),
  };
}

// Che bớt số điện thoại guest trong dữ liệu preload.
function maskPhone(phone: string) {
  if (phone.length <= 3) return "***";
  return `${"*".repeat(Math.max(phone.length - 3, 0))}${phone.slice(-3)}`;
}

// Lấy chuỗi đã trim nếu giá trị đầu vào là string không rỗng.
function asString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

// Kiểm tra chuỗi có đúng định dạng UUID hay không.
function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

