import {
  checkInTicketAtGate,
  CheckinResult,
  DeviceStatus,
  GateZoneValidationError,
  GuestStatus,
  prisma,
  Prisma,
} from "@ticketbox/database";
import { ApiError } from "../../shared/http/problem-details.js";
import type {
  OfflineSyncItemRequest,
  OfflineSyncItemStatus,
  OfflineSyncRequest,
  OfflineSyncResponse,
} from "./checkin.types.js";

type BatchContext = {
  id: string;
  batchToken: string;
  deviceId: string;
  staffId: string;
  concertId: string;
  gateId: string;
  status: "PENDING" | "SYNCING" | "DONE" | "FAILED";
};

type ItemProcessResult = {
  client_item_id: string;
  status: OfflineSyncItemStatus;
  message: string;
  ticket_id?: string | null;
  guest_id?: string | null;
};

type GuestRow = {
  id: string;
  concertId: string;
  seatZoneId: string | null;
  status: string;
};

export async function processOfflineSyncBatch(
  input: OfflineSyncRequest,
): Promise<OfflineSyncResponse> {
  const batch = await getOrCreateBatch(input);

  if (batch.status === "DONE") {
    return replayBatch(batch);
  }

  await prisma.offlineCheckinBatch.update({
    where: { id: batch.id },
    data: { status: "SYNCING" },
  });

  const seenKeys = new Set<string>();
  const results: ItemProcessResult[] = [];

  for (const item of input.items) {
    const duplicateKey = itemIdentity(item);

    if (seenKeys.has(duplicateKey)) {
      const duplicateResult = await recordDuplicateOfflineItem(batch, item, results.length);
      results.push(duplicateResult);
      continue;
    }

    seenKeys.add(duplicateKey);

    const itemGateId = item.gate_id || batch.gateId;
    if (itemGateId !== batch.gateId || item.concert_id !== batch.concertId) {
      results.push(
        await recordOfflineItem(batch, item, {
          status: "WRONG_GATE",
          message: "Offline item does not match the batch concert/gate.",
        }),
      );
      continue;
    }

    const type = resolveItemType(item);
    const result =
      type === "GUEST"
        ? await processGuestItem(batch, item)
        : await processTicketItem(batch, item);

    results.push(result);
  }

  const acceptedCount = results.filter((item) => item.status === "SUCCESS").length;
  const conflictCount = results.length - acceptedCount;

  await prisma.$transaction([
    prisma.offlineCheckinBatch.update({
      where: { id: batch.id },
      data: {
        status: "DONE",
        itemCount: results.length,
        acceptedCount,
        conflictCount,
        syncedAt: new Date(),
      },
    }),
    prisma.checkinDevice.update({
      where: { id: batch.deviceId },
      data: { lastSeenAt: new Date() },
    }),
  ]);

  return {
    batch_id: batch.batchToken,
    status: "DONE",
    accepted_item_count: acceptedCount,
    conflict_item_count: conflictCount,
    results,
  };
}

async function getOrCreateBatch(input: OfflineSyncRequest): Promise<BatchContext> {
  const existing = await prisma.offlineCheckinBatch.findUnique({
    where: { batchToken: input.batch_id },
  });

  if (existing) {
    return {
      id: existing.id,
      batchToken: existing.batchToken,
      deviceId: existing.deviceId,
      staffId: existing.staffId,
      concertId: existing.concertId,
      gateId: existing.gateId,
      status: existing.status,
    };
  }

  const first = input.items[0];
  const concertId = input.concert_id ?? first?.concert_id;
  const gateId = input.gate_id ?? first?.gate_id;

  if (!input.device_id || !concertId || !gateId) {
    throw new ApiError({
      title: "INVALID_OFFLINE_BATCH",
      status: 422,
      code: "INVALID_OFFLINE_BATCH",
      detail: "device_id, concert_id, and gate_id are required for a new offline batch.",
    });
  }

  const device = await prisma.checkinDevice.findFirst({
    where: {
      id: input.device_id,
      concertId,
      gateId,
      status: DeviceStatus.ACTIVE,
      gate: { isActive: true },
    },
    select: { id: true, staffId: true },
  });

  if (!device) {
    throw new ApiError({
      title: "DEVICE_NOT_ASSIGNED",
      status: 422,
      code: "DEVICE_NOT_ASSIGNED",
      detail: "Device is not active or is not assigned to this concert/gate.",
    });
  }

  const batch = await prisma.offlineCheckinBatch.create({
    data: {
      batchToken: input.batch_id,
      deviceId: input.device_id,
      staffId: resolveStaffId(input.staff_user_id, device.staffId),
      concertId,
      gateId,
      status: "PENDING",
    },
  });

  return {
    id: batch.id,
    batchToken: batch.batchToken,
    deviceId: batch.deviceId,
    staffId: batch.staffId,
    concertId: batch.concertId,
    gateId: batch.gateId,
    status: batch.status,
  };
}

async function replayBatch(batch: BatchContext): Promise<OfflineSyncResponse> {
  const rows = await prisma.offlineCheckinItem.findMany({
    where: { batchId: batch.id },
    orderBy: { createdAt: "asc" },
  });

  const results = rows.map((row) => ({
    client_item_id: row.clientItemId ?? row.id,
    status: mapOfflineStatus(row.result),
    message: row.errorMessage ?? row.errorCode ?? row.result,
    ticket_id: row.ticketId,
    guest_id: row.guestId,
  }));

  return {
    batch_id: batch.batchToken,
    status: "DONE",
    accepted_item_count: results.filter((item) => item.status === "SUCCESS").length,
    conflict_item_count: results.filter((item) => item.status !== "SUCCESS").length,
    results,
  };
}

async function processTicketItem(
  batch: BatchContext,
  item: OfflineSyncItemRequest,
): Promise<ItemProcessResult> {
  const scannedAt = new Date(item.scanned_at);
  const qrTokenHash = item.qr_payload_hash ?? item.qr_token ?? item.ticket_code;

  try {
    const ticket = await checkInTicketAtGate({
      ticketId: item.ticket_id,
      qrTokenHash,
      concertId: batch.concertId,
      gateId: batch.gateId,
      deviceId: batch.deviceId,
      staffId: batch.staffId,
      scannedAt,
      metadata: {
        source: "offline-sync",
        batch_token: batch.batchToken,
        client_item_id: item.client_item_id,
      },
    });

    return recordOfflineItem(batch, item, {
      status: "SUCCESS",
      message: "Ticket checked in from offline batch.",
      ticketId: ticket.id,
      seatZoneId: ticket.seatZoneId,
      qrTokenHash: ticket.qrTokenHash,
    });
  } catch (error) {
    const mapped = mapTicketError(error);
    const ticket = await findTicketForOfflineItem(item, qrTokenHash);
    return recordOfflineItem(batch, item, {
      status: mapped.status,
      message: mapped.message,
      ticketId: ticket?.id,
      seatZoneId: ticket?.seatZoneId ?? item.seat_zone_id ?? item.zone_id,
      qrTokenHash,
      errorCode: mapped.errorCode,
    });
  }
}

async function processGuestItem(
  batch: BatchContext,
  item: OfflineSyncItemRequest,
): Promise<ItemProcessResult> {
  const scannedAt = new Date(item.scanned_at);

  return prisma.$transaction(
    async (tx) => {
      const rows = item.guest_id
        ? await tx.$queryRaw<GuestRow[]>(Prisma.sql`
            SELECT
              id AS "id",
              concert_id AS "concertId",
              seat_zone_id AS "seatZoneId",
              status::text AS "status"
            FROM guest_list
            WHERE id = ${item.guest_id}::uuid
            FOR UPDATE
          `)
        : await tx.$queryRaw<GuestRow[]>(Prisma.sql`
            SELECT
              id AS "id",
              concert_id AS "concertId",
              seat_zone_id AS "seatZoneId",
              status::text AS "status"
            FROM guest_list
            WHERE concert_id = ${batch.concertId}::uuid
              AND phone = ${item.phone ?? ""}
            FOR UPDATE
          `);

      const guest = rows[0];

      if (!guest) {
        await createGuestCheckinLog(tx, batch, item, CheckinResult.INVALID_GUEST, "GUEST_NOT_FOUND", scannedAt);
        return recordOfflineItemTx(tx, batch, item, {
          status: "INVALID_GUEST",
          message: "Guest was not found.",
          errorCode: "GUEST_NOT_FOUND",
        });
      }

      if (guest.concertId !== batch.concertId) {
        await createGuestCheckinLog(tx, batch, item, CheckinResult.WRONG_CONCERT, "WRONG_CONCERT", scannedAt, guest);
        return recordOfflineItemTx(tx, batch, item, {
          status: "CONFLICT",
          message: "Guest belongs to another concert.",
          guestId: guest.id,
          seatZoneId: guest.seatZoneId ?? undefined,
          errorCode: "WRONG_CONCERT",
        });
      }

      const gateAllowed = guest.seatZoneId
        ? await gateAllowsZone(tx, batch.gateId, guest.seatZoneId, batch.concertId)
        : false;

      if (!gateAllowed) {
        await createGuestCheckinLog(tx, batch, item, CheckinResult.WRONG_GATE, "GATE_ZONE_NOT_MAPPED", scannedAt, guest);
        return recordOfflineItemTx(tx, batch, item, {
          status: "WRONG_GATE",
          message: "Guest is not allowed through this gate.",
          guestId: guest.id,
          seatZoneId: guest.seatZoneId ?? undefined,
          errorCode: "WRONG_GATE",
        });
      }

      if (guest.status === GuestStatus.CHECKED_IN) {
        await createGuestCheckinLog(tx, batch, item, CheckinResult.CONFLICT, "GUEST_ALREADY_CHECKED_IN", scannedAt, guest);
        return recordOfflineItemTx(tx, batch, item, {
          status: "CONFLICT",
          message: "Guest has already been checked in.",
          guestId: guest.id,
          seatZoneId: guest.seatZoneId ?? undefined,
          errorCode: "GUEST_ALREADY_CHECKED_IN",
        });
      }

      if (guest.status !== GuestStatus.INVITED) {
        await createGuestCheckinLog(tx, batch, item, CheckinResult.INVALID_GUEST, `GUEST_NOT_CHECKIN_READY:${guest.status}`, scannedAt, guest);
        return recordOfflineItemTx(tx, batch, item, {
          status: "INVALID_GUEST",
          message: "Guest is not in an invited state.",
          guestId: guest.id,
          seatZoneId: guest.seatZoneId ?? undefined,
          errorCode: `GUEST_NOT_CHECKIN_READY:${guest.status}`,
        });
      }

      await tx.guestList.update({
        where: { id: guest.id },
        data: {
          status: GuestStatus.CHECKED_IN,
          checkedInAt: scannedAt,
          checkedInById: batch.staffId,
        },
      });

      await createGuestCheckinLog(tx, batch, item, CheckinResult.SUCCESS, undefined, scannedAt, guest);
      return recordOfflineItemTx(tx, batch, item, {
        status: "SUCCESS",
        message: "Guest checked in from offline batch.",
        guestId: guest.id,
        seatZoneId: guest.seatZoneId ?? undefined,
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

async function recordOfflineItem(
  batch: BatchContext,
  item: OfflineSyncItemRequest,
  result: {
    status: OfflineSyncItemStatus;
    message: string;
    ticketId?: string;
    guestId?: string;
    seatZoneId?: string;
    qrTokenHash?: string;
    errorCode?: string;
  },
) {
  return prisma.$transaction((tx) => recordOfflineItemTx(tx, batch, item, result));
}

async function recordDuplicateOfflineItem(
  batch: BatchContext,
  item: OfflineSyncItemRequest,
  itemIndex: number,
): Promise<ItemProcessResult> {
  const originalClientItemId = item.client_item_id;
  const auditItem = {
    ...item,
    client_item_id: `${originalClientItemId}:duplicate:${itemIndex + 1}`,
    guest_id: undefined,
    phone: undefined,
    qr_payload_hash: undefined,
    qr_token: undefined,
    ticket_code: undefined,
    ticket_id: undefined,
  };

  const recorded = await recordOfflineItem(batch, auditItem, {
    status: "DUPLICATE_ITEM",
    message: "Duplicate item in the same offline batch.",
  });

  return {
    ...recorded,
    client_item_id: originalClientItemId,
  };
}

async function recordOfflineItemTx(
  tx: Prisma.TransactionClient,
  batch: BatchContext,
  item: OfflineSyncItemRequest,
  result: {
    status: OfflineSyncItemStatus;
    message: string;
    ticketId?: string;
    guestId?: string;
    seatZoneId?: string;
    qrTokenHash?: string;
    errorCode?: string;
  },
): Promise<ItemProcessResult> {
  const row = await tx.offlineCheckinItem.upsert({
    where: {
      batchId_clientItemId: {
        batchId: batch.id,
        clientItemId: item.client_item_id,
      },
    },
    update: {
      ticketId: result.ticketId,
      guestId: result.guestId,
      qrTokenHash: result.qrTokenHash,
      gateId: batch.gateId,
      seatZoneId: result.seatZoneId ?? item.seat_zone_id ?? item.zone_id,
      result: result.status,
      errorCode: result.errorCode,
      errorMessage: result.status === "SUCCESS" ? null : result.message,
      syncedAt: new Date(),
      metadata: {
        source: "offline-sync",
        item_type: resolveItemType(item),
        batch_token: batch.batchToken,
      },
    },
    create: {
      batchId: batch.id,
      clientItemId: item.client_item_id,
      ticketId: result.ticketId,
      guestId: result.guestId,
      qrTokenHash: result.qrTokenHash ?? item.qr_payload_hash ?? item.qr_token ?? item.ticket_code,
      gateId: batch.gateId,
      seatZoneId: result.seatZoneId ?? item.seat_zone_id ?? item.zone_id,
      result: result.status,
      errorCode: result.errorCode,
      errorMessage: result.status === "SUCCESS" ? null : result.message,
      scannedAt: new Date(item.scanned_at),
      syncedAt: new Date(),
      metadata: {
        source: "offline-sync",
        item_type: resolveItemType(item),
        batch_token: batch.batchToken,
      },
    },
  });

  return {
    client_item_id: row.clientItemId ?? item.client_item_id,
    status: mapOfflineStatus(row.result),
    message: result.message,
    ticket_id: row.ticketId,
    guest_id: row.guestId,
  };
}

async function createGuestCheckinLog(
  tx: Prisma.TransactionClient,
  batch: BatchContext,
  item: OfflineSyncItemRequest,
  result: CheckinResult,
  reason: string | undefined,
  scannedAt: Date,
  guest?: GuestRow,
) {
  await tx.checkinLog.create({
    data: {
      guestId: guest?.id,
      concertId: batch.concertId,
      seatZoneId: guest?.seatZoneId,
      gateId: batch.gateId,
      deviceId: batch.deviceId,
      staffId: batch.staffId,
      result,
      reason,
      scannedAt,
      metadata: {
        source: "offline-sync",
        batch_token: batch.batchToken,
        client_item_id: item.client_item_id,
      },
    },
  });
}

async function gateAllowsZone(
  tx: Prisma.TransactionClient,
  gateId: string,
  seatZoneId: string,
  concertId: string,
) {
  const mapping = await tx.checkinGateZone.findUnique({
    where: { gateId_seatZoneId: { gateId, seatZoneId } },
    select: {
      concertId: true,
      gate: { select: { isActive: true, concertId: true } },
      seatZone: { select: { concertId: true } },
    },
  });

  return Boolean(
    mapping &&
      mapping.concertId === concertId &&
      mapping.gate.concertId === concertId &&
      mapping.seatZone.concertId === concertId &&
      mapping.gate.isActive,
  );
}

async function findTicketForOfflineItem(item: OfflineSyncItemRequest, qrTokenHash?: string) {
  if (item.ticket_id) {
    return prisma.ticket.findUnique({
      where: { id: item.ticket_id },
      select: { id: true, seatZoneId: true },
    });
  }

  if (!qrTokenHash) return null;

  return prisma.ticket.findUnique({
    where: { qrTokenHash },
    select: { id: true, seatZoneId: true },
  });
}

function mapTicketError(error: unknown): {
  status: OfflineSyncItemStatus;
  message: string;
  errorCode: string;
} {
  if (error instanceof GateZoneValidationError) {
    if (error.code === "GATE_ZONE_NOT_MAPPED" || error.code === "GATE_INACTIVE" || error.code === "GATE_CONCERT_MISMATCH") {
      return {
        status: "WRONG_GATE",
        message: "Ticket is not allowed through this gate.",
        errorCode: error.code,
      };
    }

    if (error.code === "TICKET_ALREADY_CHECKED_IN") {
      return {
        status: "CONFLICT",
        message: "Ticket has already been checked in before this offline batch.",
        errorCode: error.code,
      };
    }

    if (error.code === "WRONG_CONCERT") {
      return {
        status: "CONFLICT",
        message: "Ticket belongs to another concert.",
        errorCode: error.code,
      };
    }

    return {
      status: "INVALID_TICKET",
      message: error.message,
      errorCode: error.code,
    };
  }

  return {
    status: "ERROR",
    message: error instanceof Error ? error.message : String(error),
    errorCode: "ERROR",
  };
}

function itemIdentity(item: OfflineSyncItemRequest) {
  return [
    item.type ?? resolveItemType(item),
    item.client_item_id,
    item.ticket_id,
    item.guest_id,
    item.phone,
    item.qr_payload_hash,
    item.qr_token,
    item.ticket_code,
  ]
    .filter(Boolean)
    .join(":");
}

function resolveItemType(item: OfflineSyncItemRequest): "TICKET" | "GUEST" {
  if (item.type) return item.type;
  return item.guest_id || item.phone ? "GUEST" : "TICKET";
}

function resolveStaffId(inputStaffId: string | undefined, deviceStaffId: string) {
  return inputStaffId && isUuid(inputStaffId) ? inputStaffId : deviceStaffId;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function mapOfflineStatus(value: string): OfflineSyncItemStatus {
  if (
    value === "SUCCESS" ||
    value === "ALREADY_CHECKED_IN" ||
    value === "WRONG_GATE" ||
    value === "INVALID_TICKET" ||
    value === "INVALID_GUEST" ||
    value === "CONFLICT" ||
    value === "DUPLICATE_ITEM" ||
    value === "ERROR"
  ) {
    return value;
  }

  if (value === "ACCEPTED") return "SUCCESS";
  if (value === "INVALID") return "INVALID_TICKET";
  return "ERROR";
}
