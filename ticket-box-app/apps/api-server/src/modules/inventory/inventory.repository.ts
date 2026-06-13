import {
  prisma,
  Prisma,
  createHeldOrder,
  releaseHeldOrder,
  confirmHeldOrder,
  InventoryReservationError,
} from "@ticketbox/database";
import { cacheDelete } from "@ticketbox/redis";
import { ApiError } from "../../shared/http/problem-details.js";
import { withSerializableRetry } from "../../shared/db/serializable-retry.js";
import type {
  HoldRequest,
  ReleaseRequest,
  PaymentConfirmationRequest,
  InventoryAdjustmentRequest,
} from "./inventory.type.js";

const inventoryCacheKey = (ticketTypeId: string) => `inventory:${ticketTypeId}`;

export class InventoryError extends ApiError {
  code: string;
  statusCode: number;

  constructor(code: string, statusCode: number, detail: string) {
    super({
      title: code,
      status: statusCode,
      code,
      detail,
    });
    this.code = code;
    this.statusCode = statusCode;
  }
}

type TicketTypeRow = {
  id: string;
  concertId: string;
  seatZoneId: string;
  totalQuantity: number;
  heldQuantity: number;
  soldQuantity: number;
  maxPerUser: number;
  price: string;
  currency: string;
  saleStartAt: Date;
  saleEndAt: Date;
  status: string;
  updatedAt: Date;
};

export async function getInventoryByTicketTypeId(ticketTypeId: string) {
  const [row] = await prisma.$queryRaw<TicketTypeRow[]>(Prisma.sql`
    SELECT
      id,
      concert_id AS "concertId",
      seat_zone_id AS "seatZoneId",
      total_quantity AS "totalQuantity",
      held_quantity AS "heldQuantity",
      sold_quantity AS "soldQuantity",
      max_per_user AS "maxPerUser",
      price::text AS "price",
      currency,
      sale_start_at AS "saleStartAt",
      sale_end_at AS "saleEndAt",
      status::text AS "status",
      updated_at AS "updatedAt"
    FROM ticket_types
    WHERE id = ${ticketTypeId}::uuid
  `);

  if (!row) {
    throw new InventoryError("TICKET_TYPE_NOT_FOUND", 404, "Ticket type not found");
  }

  return row;
}

// Map typed InventoryReservationError (từ @ticketbox/database) sang InventoryError
// với HTTP code mà module inventory đang dùng.
function mapReservationError(err: unknown): unknown {
  // Trùng idempotency_key (DB unique) — backstop của idempotencyMiddleware.
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === "P2002" &&
    (err.meta?.target as string[] | undefined)?.includes("idempotency_key")
  ) {
    return new InventoryError(
      "DUPLICATE_REQUEST",
      409,
      "A request with this Idempotency-Key already exists.",
    );
  }
  if (!(err instanceof InventoryReservationError)) return err;
  switch (err.code) {
    case "TICKET_TYPE_NOT_FOUND":
      return new InventoryError("TICKET_TYPE_NOT_FOUND", 404, err.message);
    case "TICKET_TYPE_NOT_ON_SALE":
    case "SALE_WINDOW_CLOSED":
      return new InventoryError("TICKET_TYPE_NOT_ON_SALE", 422, err.message);
    case "INSUFFICIENT_INVENTORY":
      return new InventoryError("TICKET_SOLD_OUT", 409, err.message);
    case "MAX_PER_USER_EXCEEDED":
      return new InventoryError("PER_USER_LIMIT_EXCEEDED", 409, err.message);
    default:
      // INVALID_QUANTITY / DUPLICATE_ITEMS / INVALID_EXPIRATION — thường đã bị Zod
      // chặn trước khi tới đây; map phòng thủ.
      return new InventoryError("VALIDATION_ERROR", 422, err.message);
  }
}

// Wrapper mỏng quanh nguồn sự thật createHeldOrder (@ticketbox/database).
export async function holdInventory(req: HoldRequest, idempotencyKey: string) {
  let result;
  try {
    result = await createHeldOrder({
      userId: req.user_id,
      concertId: req.concert_id,
      items: req.items.map((i) => ({
        ticketTypeId: i.ticket_type_id,
        quantity: i.quantity,
      })),
      holdExpiresAt: new Date(req.hold_expires_at),
      idempotencyKey,
    });
  } catch (err) {
    throw mapReservationError(err);
  }

  // Invalidate cache cho mọi ticket type bị ảnh hưởng (sau khi transaction commit).
  await Promise.allSettled(
    result.items.map((i) => cacheDelete(inventoryCacheKey(i.ticketTypeId))),
  );

  return {
    order: {
      id: result.orderId,
      status: result.status,
      holdExpiresAt: result.holdExpiresAt,
    },
    itemResults: result.items.map((i) => ({
      ticket_type_id: i.ticketTypeId,
      quantity: i.quantity,
      available_quantity_after: i.availableQuantityAfter,
    })),
  };
}

// Wrapper mỏng quanh nguồn sự thật releaseHeldOrder (@ticketbox/database).
// Chính sách inventory: not-found -> 404; đã release rồi -> idempotent (trả rỗng).
export async function releaseInventory(req: ReleaseRequest) {
  const result = await releaseHeldOrder({
    orderId: req.order_id,
    reason: req.reason,
  });

  if (result.outcome === "NOT_FOUND") {
    throw new InventoryError("ORDER_NOT_FOUND", 404, "Order not found");
  }

  const releasedItems = result.releasedItems.map((i) => ({
    ticket_type_id: i.ticketTypeId,
    quantity: i.quantity,
  }));

  await Promise.allSettled(
    releasedItems.map((i) => cacheDelete(inventoryCacheKey(i.ticket_type_id))),
  );

  return {
    orderId: result.orderId,
    status: result.status,
    releasedItems,
  };
}

// Wrapper mỏng quanh nguồn sự thật confirmHeldOrder (@ticketbox/database).
export async function confirmPayment(req: PaymentConfirmationRequest) {
  const result = await confirmHeldOrder({ orderId: req.order_id });

  if (result.outcome === "NOT_FOUND") {
    throw new InventoryError("ORDER_NOT_FOUND", 404, "Order not found");
  }
  if (result.outcome === "NOT_HELD") {
    throw new InventoryError(
      "ORDER_NOT_HELD",
      409,
      `Order is in status ${result.status} and cannot be confirmed`,
    );
  }

  await Promise.allSettled(
    result.confirmedTicketTypeIds.map((id) =>
      cacheDelete(inventoryCacheKey(id)),
    ),
  );

  return {
    orderId: result.orderId,
    status: result.status,
    confirmedAt: result.confirmedAt!,
  };
}

export async function adjustInventory(
  ticketTypeId: string,
  req: InventoryAdjustmentRequest,
  actorUserId?: string,
) {
  const result = await withSerializableRetry(() =>
    prisma.$transaction(
    async (tx) => {
      const [row] = await tx.$queryRaw<TicketTypeRow[]>(Prisma.sql`
      SELECT
        id,
        concert_id AS "concertId",
        seat_zone_id AS "seatZoneId",
        total_quantity AS "totalQuantity",
        held_quantity AS "heldQuantity",
        sold_quantity AS "soldQuantity",
        max_per_user AS "maxPerUser",
        price::text AS "price",
        currency,
        sale_start_at AS "saleStartAt",
        sale_end_at AS "saleEndAt",
        status::text AS "status",
        updated_at AS "updatedAt"
      FROM ticket_types
      WHERE id = ${ticketTypeId}::uuid
      FOR UPDATE
    `);

      if (!row) {
        throw new InventoryError("TICKET_TYPE_NOT_FOUND", 404, "Ticket type not found");
      }

      const newTotal = row.totalQuantity + req.delta_total_quantity;
      const available = row.totalQuantity - row.heldQuantity - row.soldQuantity;
      const newAvailable = available + req.delta_total_quantity;

      if (newAvailable < 0) {
        throw new InventoryError(
          "INVENTORY_INVARIANT_VIOLATED",
          422,
          "Adjustment would make available_quantity negative",
        );
      }

      if (newTotal < 0) {
        throw new InventoryError(
          "INVENTORY_INVARIANT_VIOLATED",
          422,
          "total_quantity cannot be negative",
        );
      }

      // Check against seat zone capacity
      const [zone] = await tx.$queryRaw<Array<{ capacity: number }>>(Prisma.sql`
      SELECT capacity
      FROM seat_zones
      WHERE id = ${row.seatZoneId}::uuid AND concert_id = ${row.concertId}::uuid
    `);

      if (zone && newTotal > zone.capacity) {
        throw new InventoryError(
          "ZONE_CAPACITY_EXCEEDED",
          422,
          `New total_quantity ${newTotal} exceeds seat zone capacity ${zone.capacity}`,
        );
      }

      await tx.$executeRaw(Prisma.sql`
      UPDATE ticket_types
      SET total_quantity = ${newTotal}
      WHERE id = ${ticketTypeId}::uuid
    `);

      const auditLog = await tx.auditLog.create({
        data: {
          actorUserId: actorUserId ?? null,
          action: "INVENTORY_ADJUSTED",
          entityType: "ticket_type",
          entityId: ticketTypeId,
          metadata: {
            delta_total_quantity: req.delta_total_quantity,
            old_total_quantity: row.totalQuantity,
            new_total_quantity: newTotal,
            reason: req.reason,
          },
        },
      });

      return {
        ticketTypeId,
        totalQuantity: newTotal,
        availableQuantity: newAvailable,
        auditLogId: auditLog.id,
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );

  await cacheDelete(inventoryCacheKey(ticketTypeId));

  return result;
}
