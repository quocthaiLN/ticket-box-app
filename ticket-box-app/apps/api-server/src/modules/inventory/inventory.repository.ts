import { prisma, Prisma, OrderStatus } from "@ticketbox/database";
import { cacheDelete } from "@ticketbox/redis";
import { ApiError } from "../../shared/http/problem-details.js";
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

type UserCounterRow = {
  heldQuantity: number;
  paidQuantity: number;
};

type OrderWithItemsRow = {
  orderId: string;
  orderStatus: string;
  holdExpiresAt: Date | null;
  confirmedAt: Date | null;
  expiredAt: Date | null;
  cancelledAt: Date | null;
  itemId: string;
  ticketTypeId: string;
  quantity: number;
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

export async function holdInventory(req: HoldRequest, idempotencyKey: string) {
  const holdExpiresAt = new Date(req.hold_expires_at);
  const now = new Date();

  // Sort outside transaction so we can reference after commit for cache invalidation
  const sortedItems = [...req.items].sort((a, b) =>
    a.ticket_type_id.localeCompare(b.ticket_type_id),
  );

  const result = await prisma.$transaction(
    async (tx) => {
      const ticketTypeIds = sortedItems.map((i) => i.ticket_type_id);

      const ticketTypes = await tx.$queryRaw<TicketTypeRow[]>(Prisma.sql`
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
      WHERE id = ANY(${ticketTypeIds}::uuid[])
      ORDER BY id
      FOR UPDATE
    `);

      if (ticketTypes.length !== ticketTypeIds.length) {
        throw new InventoryError(
          "TICKET_TYPE_NOT_FOUND",
          404,
          "One or more ticket types not found",
        );
      }

      const typeMap = new Map(ticketTypes.map((t) => [t.id, t]));

      // Validate status, sale window, and availability for all items
      for (const item of sortedItems) {
        const tt = typeMap.get(item.ticket_type_id)!;

        if (tt.concertId !== req.concert_id) {
          throw new InventoryError(
            "TICKET_TYPE_NOT_ON_SALE",
            422,
            `Ticket type ${item.ticket_type_id} does not belong to concert`,
          );
        }
        if (tt.status !== "ON_SALE") {
          throw new InventoryError(
            "TICKET_TYPE_NOT_ON_SALE",
            422,
            `Ticket type ${item.ticket_type_id} is not on sale`,
          );
        }
        if (now < tt.saleStartAt || now > tt.saleEndAt) {
          throw new InventoryError(
            "TICKET_TYPE_NOT_ON_SALE",
            422,
            `Ticket type ${item.ticket_type_id} is outside the sale window`,
          );
        }

        const available = tt.totalQuantity - tt.heldQuantity - tt.soldQuantity;
        if (available < item.quantity) {
          throw new InventoryError(
            "TICKET_SOLD_OUT",
            409,
            `Not enough available tickets for type ${item.ticket_type_id}`,
          );
        }
      }

      // Lock user counters and enforce per-user limits
      for (const item of sortedItems) {
        await tx.$executeRaw(Prisma.sql`
        INSERT INTO user_ticket_type_counters (user_id, ticket_type_id, held_quantity, paid_quantity)
        VALUES (${req.user_id}::uuid, ${item.ticket_type_id}::uuid, 0, 0)
        ON CONFLICT (user_id, ticket_type_id) DO NOTHING
      `);

        const [counter] = await tx.$queryRaw<UserCounterRow[]>(Prisma.sql`
        SELECT held_quantity AS "heldQuantity", paid_quantity AS "paidQuantity"
        FROM user_ticket_type_counters
        WHERE user_id = ${req.user_id}::uuid AND ticket_type_id = ${item.ticket_type_id}::uuid
        FOR UPDATE
      `);

        const tt = typeMap.get(item.ticket_type_id)!;
        if (
          counter.heldQuantity + counter.paidQuantity + item.quantity >
          tt.maxPerUser
        ) {
          throw new InventoryError(
            "PER_USER_LIMIT_EXCEEDED",
            409,
            `Purchase would exceed per-user limit for ticket type ${item.ticket_type_id}`,
          );
        }
      }

      // Calculate total amount
      let totalAmount = new Prisma.Decimal(0);
      for (const item of sortedItems) {
        const tt = typeMap.get(item.ticket_type_id)!;
        totalAmount = totalAmount.plus(
          new Prisma.Decimal(tt.price).times(item.quantity),
        );
      }

      // Create order
      const order = await tx.order.create({
        data: {
          userId: req.user_id,
          concertId: req.concert_id,
          idempotencyKey,
          status: OrderStatus.HELD,
          holdExpiresAt,
          totalAmount,
          currency: typeMap.values().next().value!.currency,
        },
      });

      const itemResults: Array<{
        ticket_type_id: string;
        quantity: number;
        available_quantity_after: number;
      }> = [];

      for (const item of sortedItems) {
        const tt = typeMap.get(item.ticket_type_id)!;

        await tx.orderItem.create({
          data: {
            orderId: order.id,
            ticketTypeId: item.ticket_type_id,
            quantity: item.quantity,
            unitPrice: new Prisma.Decimal(tt.price),
            lineTotal: new Prisma.Decimal(tt.price).times(item.quantity),
          },
        });

        await tx.$executeRaw(Prisma.sql`
        UPDATE ticket_types
        SET held_quantity = held_quantity + ${item.quantity}
        WHERE id = ${item.ticket_type_id}::uuid
      `);

        await tx.$executeRaw(Prisma.sql`
        UPDATE user_ticket_type_counters
        SET held_quantity = held_quantity + ${item.quantity}
        WHERE user_id = ${req.user_id}::uuid AND ticket_type_id = ${item.ticket_type_id}::uuid
      `);

        const available =
          tt.totalQuantity - tt.heldQuantity - tt.soldQuantity - item.quantity;
        itemResults.push({
          ticket_type_id: item.ticket_type_id,
          quantity: item.quantity,
          available_quantity_after: available,
        });
      }

      return { order, itemResults };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );

  await Promise.allSettled(
    sortedItems.map((item) =>
      cacheDelete(inventoryCacheKey(item.ticket_type_id)),
    ),
  );

  return result;
}

export async function releaseInventory(req: ReleaseRequest) {
  let releasedTicketTypeIds: string[] = [];

  const result = await prisma.$transaction(
    async (tx) => {
      const rows = await tx.$queryRaw<OrderWithItemsRow[]>(Prisma.sql`
      SELECT
        o.id AS "orderId",
        o.status::text AS "orderStatus",
        o.hold_expires_at AS "holdExpiresAt",
        o.confirmed_at AS "confirmedAt",
        o.expired_at AS "expiredAt",
        o.cancelled_at AS "cancelledAt",
        oi.id AS "itemId",
        oi.ticket_type_id AS "ticketTypeId",
        oi.quantity
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      WHERE o.id = ${req.order_id}::uuid
      FOR UPDATE OF o
    `);

      if (rows.length === 0) {
        throw new InventoryError("ORDER_NOT_FOUND", 404, "Order not found");
      }

      const orderStatus = rows[0].orderStatus;

      // Idempotent: if already released, return current state without modifying inventory
      if (orderStatus !== OrderStatus.HELD) {
        return {
          orderId: rows[0].orderId,
          status: orderStatus,
          releasedItems: [],
        };
      }

      const newStatus =
        req.reason === "HOLD_EXPIRED"
          ? OrderStatus.EXPIRED
          : OrderStatus.CANCELLED;
      const now = new Date();

      await tx.order.update({
        where: { id: req.order_id },
        data: {
          status: newStatus,
          ...(newStatus === OrderStatus.EXPIRED
            ? { expiredAt: now }
            : { cancelledAt: now, cancelledReason: req.reason }),
        },
      });

      const releasedItems: Array<{ ticket_type_id: string; quantity: number }> =
        [];

      for (const row of rows) {
        await tx.$executeRaw(Prisma.sql`
        UPDATE ticket_types
        SET held_quantity = GREATEST(0, held_quantity - ${row.quantity})
        WHERE id = ${row.ticketTypeId}::uuid
      `);

        // Release user counter — userId comes from the order
        await tx.$executeRaw(Prisma.sql`
        UPDATE user_ticket_type_counters utc
        SET held_quantity = GREATEST(0, utc.held_quantity - ${row.quantity})
        FROM orders o
        WHERE o.id = ${req.order_id}::uuid
          AND utc.user_id = o.user_id
          AND utc.ticket_type_id = ${row.ticketTypeId}::uuid
      `);

        releasedItems.push({
          ticket_type_id: row.ticketTypeId,
          quantity: row.quantity,
        });
      }

      releasedTicketTypeIds = releasedItems.map((i) => i.ticket_type_id);
      return { orderId: req.order_id, status: newStatus, releasedItems };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );

  await Promise.allSettled(
    releasedTicketTypeIds.map((id) => cacheDelete(inventoryCacheKey(id))),
  );

  return result;
}

export async function confirmPayment(req: PaymentConfirmationRequest) {
  let confirmedTicketTypeIds: string[] = [];

  const result = await prisma.$transaction(
    async (tx) => {
      const rows = await tx.$queryRaw<OrderWithItemsRow[]>(Prisma.sql`
      SELECT
        o.id AS "orderId",
        o.status::text AS "orderStatus",
        o.hold_expires_at AS "holdExpiresAt",
        o.confirmed_at AS "confirmedAt",
        o.expired_at AS "expiredAt",
        o.cancelled_at AS "cancelledAt",
        oi.id AS "itemId",
        oi.ticket_type_id AS "ticketTypeId",
        oi.quantity
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      WHERE o.id = ${req.order_id}::uuid
      FOR UPDATE OF o
    `);

      if (rows.length === 0) {
        throw new InventoryError("ORDER_NOT_FOUND", 404, "Order not found");
      }

      const orderStatus = rows[0].orderStatus;

      if (orderStatus !== OrderStatus.HELD) {
        throw new InventoryError(
          "ORDER_NOT_HELD",
          409,
          `Order is in status ${orderStatus} and cannot be confirmed`,
        );
      }

      const now = new Date();

      await tx.order.update({
        where: { id: req.order_id },
        data: { status: OrderStatus.CONFIRMED, confirmedAt: now },
      });

      for (const row of rows) {
        // Move held → sold in ticket_types
        await tx.$executeRaw(Prisma.sql`
        UPDATE ticket_types
        SET
          held_quantity = GREATEST(0, held_quantity - ${row.quantity}),
          sold_quantity = sold_quantity + ${row.quantity}
        WHERE id = ${row.ticketTypeId}::uuid
      `);

        // Move held → paid in user counters
        await tx.$executeRaw(Prisma.sql`
        UPDATE user_ticket_type_counters utc
        SET
          held_quantity = GREATEST(0, utc.held_quantity - ${row.quantity}),
          paid_quantity = utc.paid_quantity + ${row.quantity}
        FROM orders o
        WHERE o.id = ${req.order_id}::uuid
          AND utc.user_id = o.user_id
          AND utc.ticket_type_id = ${row.ticketTypeId}::uuid
      `);
      }

      // Link payment record if it exists
      await tx.$executeRaw(Prisma.sql`
      UPDATE payments
      SET order_id = ${req.order_id}::uuid
      WHERE id = ${req.payment_id}::uuid AND order_id = ${req.order_id}::uuid
    `);

      confirmedTicketTypeIds = [...new Set(rows.map((r) => r.ticketTypeId))];
      return {
        orderId: req.order_id,
        status: OrderStatus.CONFIRMED,
        confirmedAt: now,
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );

  await Promise.allSettled(
    confirmedTicketTypeIds.map((id) => cacheDelete(inventoryCacheKey(id))),
  );

  return result;
}

export async function adjustInventory(
  ticketTypeId: string,
  req: InventoryAdjustmentRequest,
  actorUserId?: string,
) {
  const result = await prisma.$transaction(
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
  );

  await cacheDelete(inventoryCacheKey(ticketTypeId));

  return result;
}
