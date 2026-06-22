import {
  prisma,
  Prisma,
  OrderStatus,
  PaymentStatus,
  PaymentProvider,
} from "@ticketbox/database";
import { cacheDelete } from "@ticketbox/redis";
import { ApiError } from "../../shared/http/problem-details.js";
import type {
  CreateOrderRequest,
  AdminOrderRow,
  AdminOrdersQuery,
} from "./order.type.js";

const inventoryCacheKey = (ticketTypeId: string) => `inventory:${ticketTypeId}`;

type TicketTypeRow = {
  id: string;
  concertId: string;
  seatZoneId: string;
  name: string;
  totalQuantity: number;
  heldQuantity: number;
  soldQuantity: number;
  maxPerUser: number;
  price: string;
  currency: string;
  saleStartAt: Date;
  saleEndAt: Date;
  status: string;
};

type UserCounterRow = {
  heldQuantity: number;
  paidQuantity: number;
};

type OrderItemRow = {
  id: string;
  orderId: string;
  ticketTypeId: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
  ticketTypeName: string;
  ticketTypePrice: string;
  ticketTypeCurrency: string;
  seatZoneCode: string;
  seatZoneName: string;
};

type PaymentRow = {
  id: string;
  orderId: string;
  provider: string;
  status: string;
  checkoutUrl: string | null;
  amount: string;
  currency: string;
  paidAt: Date | null;
  failureReason: string | null;
  createdAt: Date;
};

type TicketRow = {
  id: string;
  status: string;
  issuedAt: Date | null;
  ticketTypeId: string;
  ticketTypeName: string;
  seatZoneCode: string;
  seatZoneName: string;
};

type OrderDetailRow = {
  id: string;
  userId: string;
  concertId: string;
  status: string;
  totalAmount: string;
  currency: string;
  holdExpiresAt: Date | null;
  confirmedAt: Date | null;
  cancelledAt: Date | null;
  expiredAt: Date | null;
  cancelledReason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateOrderResult = {
  order: {
    id: string;
    userId: string;
    concertId: string;
    status: string;
    totalAmount: string;
    currency: string;
    holdExpiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
  };
  items: Array<{
    id: string;
    ticketTypeId: string;
    quantity: number;
    unitPrice: string;
    lineTotal: string;
  }>;
};

export type OrderWithDetails = {
  order: OrderDetailRow;
  items: OrderItemRow[];
  payment: PaymentRow | null;
  tickets: TicketRow[];
};

export async function createOrderHeld(
  userId: string,
  req: CreateOrderRequest,
  idempotencyKey: string,
): Promise<CreateOrderResult> {
  const sortedItems = [...req.items].sort((a, b) =>
    a.ticket_type_id.localeCompare(b.ticket_type_id),
  );

  const holdExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
  const now = new Date();

  const result = await prisma.$transaction(
    async (tx) => {
      const ticketTypeIds = sortedItems.map((i) => i.ticket_type_id);

      const ticketTypes = await tx.$queryRaw<TicketTypeRow[]>(Prisma.sql`
      SELECT
        id,
        concert_id AS "concertId",
        seat_zone_id AS "seatZoneId",
        name,
        total_quantity AS "totalQuantity",
        held_quantity AS "heldQuantity",
        sold_quantity AS "soldQuantity",
        max_per_user AS "maxPerUser",
        price::text AS "price",
        currency,
        sale_start_at AS "saleStartAt",
        sale_end_at AS "saleEndAt",
        status::text AS "status"
      FROM ticket_types
      WHERE id = ANY(${ticketTypeIds}::uuid[])
      ORDER BY id
      FOR UPDATE
    `);

      if (ticketTypes.length !== ticketTypeIds.length) {
        throw new ApiError({
          title: "TICKET_TYPE_NOT_FOUND",
          status: 404,
          code: "TICKET_TYPE_NOT_FOUND",
          detail: "One or more ticket types not found",
        });
      }

      const typeMap = new Map(ticketTypes.map((t) => [t.id, t]));

      for (const item of sortedItems) {
        const tt = typeMap.get(item.ticket_type_id);
        if (!tt) {
          throw new ApiError({
            title: "TICKET_TYPE_NOT_FOUND",
            status: 404,
            code: "TICKET_TYPE_NOT_FOUND",
            detail: `Ticket type ${item.ticket_type_id} not found`,
          });
        }

        if (tt.concertId !== req.concert_id) {
          throw new ApiError({
            title: "TICKET_TYPE_NOT_ON_SALE",
            status: 422,
            code: "TICKET_TYPE_NOT_ON_SALE",
            detail: `Ticket type ${item.ticket_type_id} does not belong to concert ${req.concert_id}`,
          });
        }

        if (tt.status !== "ON_SALE") {
          throw new ApiError({
            title: "TICKET_TYPE_NOT_ON_SALE",
            status: 422,
            code: "TICKET_TYPE_NOT_ON_SALE",
            detail: `Ticket type ${item.ticket_type_id} is not on sale`,
          });
        }

        if (now < tt.saleStartAt || now > tt.saleEndAt) {
          throw new ApiError({
            title: "TICKET_TYPE_NOT_ON_SALE",
            status: 422,
            code: "TICKET_TYPE_NOT_ON_SALE",
            detail: `Ticket type ${item.ticket_type_id} is outside the sale window`,
          });
        }

        const available = tt.totalQuantity - tt.heldQuantity - tt.soldQuantity;
        if (available < item.quantity) {
          throw new ApiError({
            title: "TICKET_SOLD_OUT",
            status: 409,
            code: "TICKET_SOLD_OUT",
            detail: `Not enough available tickets for type ${item.ticket_type_id}`,
          });
        }
      }

      // Lock user counters and enforce per-user limits
      for (const item of sortedItems) {
        await tx.$executeRaw(Prisma.sql`
        INSERT INTO user_ticket_type_counters (user_id, ticket_type_id, held_quantity, paid_quantity)
        VALUES (${userId}::uuid, ${item.ticket_type_id}::uuid, 0, 0)
        ON CONFLICT (user_id, ticket_type_id) DO NOTHING
      `);

        const [counter] = await tx.$queryRaw<UserCounterRow[]>(Prisma.sql`
        SELECT held_quantity AS "heldQuantity", paid_quantity AS "paidQuantity"
        FROM user_ticket_type_counters
        WHERE user_id = ${userId}::uuid AND ticket_type_id = ${item.ticket_type_id}::uuid
        FOR UPDATE
      `);

        if (!counter) {
          throw new ApiError({
            title: "INVENTORY_ERROR",
            status: 500,
            code: "INVENTORY_ERROR",
            detail: `Could not lock user counter for ticket type ${item.ticket_type_id}`,
          });
        }
        const tt = typeMap.get(item.ticket_type_id)!;
        if (
          counter.heldQuantity + counter.paidQuantity + item.quantity >
          tt.maxPerUser
        ) {
          throw new ApiError({
            title: "PER_USER_LIMIT_EXCEEDED",
            status: 422,
            code: "PER_USER_LIMIT_EXCEEDED",
            detail: `Purchase would exceed per-user limit for ticket type ${item.ticket_type_id}`,
          });
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

      const currency = typeMap.get(sortedItems[0].ticket_type_id)!.currency;

      // Create order
      const order = await tx.order.create({
        data: {
          userId,
          concertId: req.concert_id,
          idempotencyKey,
          status: OrderStatus.HELD,
          holdExpiresAt,
          totalAmount,
          currency,
        },
      });

      const createdItems: Array<{
        id: string;
        ticketTypeId: string;
        quantity: number;
        unitPrice: string;
        lineTotal: string;
      }> = [];

      for (const item of sortedItems) {
        const tt = typeMap.get(item.ticket_type_id)!;
        const unitPrice = new Prisma.Decimal(tt.price);
        const lineTotal = unitPrice.times(item.quantity);

        const orderItem = await tx.orderItem.create({
          data: {
            orderId: order.id,
            ticketTypeId: item.ticket_type_id,
            quantity: item.quantity,
            unitPrice,
            lineTotal,
          },
        });

        createdItems.push({
          id: orderItem.id,
          ticketTypeId: item.ticket_type_id,
          quantity: item.quantity,
          unitPrice: unitPrice.toString(),
          lineTotal: lineTotal.toString(),
        });

        await tx.$executeRaw(Prisma.sql`
        UPDATE ticket_types
        SET held_quantity = held_quantity + ${item.quantity}
        WHERE id = ${item.ticket_type_id}::uuid
      `);

        await tx.$executeRaw(Prisma.sql`
        UPDATE user_ticket_type_counters
        SET held_quantity = held_quantity + ${item.quantity}
        WHERE user_id = ${userId}::uuid AND ticket_type_id = ${item.ticket_type_id}::uuid
      `);
      }

      return {
        order: {
          id: order.id,
          userId: order.userId,
          concertId: order.concertId,
          status: order.status,
          totalAmount: order.totalAmount.toString(),
          currency: order.currency,
          holdExpiresAt: order.holdExpiresAt!,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt,
        },
        items: createdItems,
      };
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

export async function createPaymentRecord(
  orderId: string,
  amount: string,
  currency: string,
  provider: "VNPAY" | "MOMO",
  checkoutUrl: string,
  idempotencyKey: string,
): Promise<{ id: string; status: string; checkoutUrl: string }> {
  const payment = await prisma.payment.create({
    data: {
      orderId,
      provider:
        provider === "VNPAY" ? PaymentProvider.VNPAY : PaymentProvider.MOMO,
      idempotencyKey,
      amount: new Prisma.Decimal(amount),
      currency,
      status: PaymentStatus.PENDING,
      checkoutUrl,
    },
  });

  return {
    id: payment.id,
    status: payment.status,
    checkoutUrl: payment.checkoutUrl ?? checkoutUrl,
  };
}

export async function getOrderWithDetails(
  orderId: string,
): Promise<OrderWithDetails | null> {
  const [order] = await prisma.$queryRaw<OrderDetailRow[]>(Prisma.sql`
    SELECT
      id,
      user_id AS "userId",
      concert_id AS "concertId",
      status::text AS "status",
      total_amount::text AS "totalAmount",
      currency,
      hold_expires_at AS "holdExpiresAt",
      confirmed_at AS "confirmedAt",
      cancelled_at AS "cancelledAt",
      expired_at AS "expiredAt",
      cancelled_reason AS "cancelledReason",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM orders
    WHERE id = ${orderId}::uuid
  `);

  if (!order) return null;

  const items = await prisma.$queryRaw<OrderItemRow[]>(Prisma.sql`
    SELECT
      oi.id,
      oi.order_id AS "orderId",
      oi.ticket_type_id AS "ticketTypeId",
      oi.quantity,
      oi.unit_price::text AS "unitPrice",
      oi.line_total::text AS "lineTotal",
      tt.name AS "ticketTypeName",
      tt.price::text AS "ticketTypePrice",
      tt.currency AS "ticketTypeCurrency",
      sz.code AS "seatZoneCode",
      sz.name AS "seatZoneName"
    FROM order_items oi
    JOIN ticket_types tt ON tt.id = oi.ticket_type_id
    JOIN seat_zones sz ON sz.id = tt.seat_zone_id AND sz.concert_id = tt.concert_id
    WHERE oi.order_id = ${orderId}::uuid
  `);

  const payments = await prisma.$queryRaw<PaymentRow[]>(Prisma.sql`
    SELECT
      id,
      order_id AS "orderId",
      provider::text AS "provider",
      status::text AS "status",
      checkout_url AS "checkoutUrl",
      amount::text AS "amount",
      currency,
      paid_at AS "paidAt",
      failure_reason AS "failureReason",
      created_at AS "createdAt"
    FROM payments
    WHERE order_id = ${orderId}::uuid
    ORDER BY created_at DESC
    LIMIT 1
  `);

  const tickets = await prisma.$queryRaw<TicketRow[]>(Prisma.sql`
    SELECT
      t.id,
      t.status::text AS "status",
      t.issued_at AS "issuedAt",
      t.ticket_type_id AS "ticketTypeId",
      tt.name AS "ticketTypeName",
      sz.code AS "seatZoneCode",
      sz.name AS "seatZoneName"
    FROM tickets t
    JOIN ticket_types tt ON tt.id = t.ticket_type_id AND tt.concert_id = t.concert_id
    JOIN seat_zones sz ON sz.id = t.seat_zone_id AND sz.concert_id = t.concert_id
    WHERE t.order_id = ${orderId}::uuid
  `);

  return {
    order,
    items,
    payment: payments[0] ?? null,
    tickets,
  };
}

export async function getOrderByIdempotencyKey(
  idempotencyKey: string,
): Promise<{ id: string; status: string } | null> {
  const [row] = await prisma.$queryRaw<
    Array<{ id: string; status: string }>
  >(Prisma.sql`
    SELECT id, status::text AS "status"
    FROM orders
    WHERE idempotency_key = ${idempotencyKey}
  `);

  return row ?? null;
}

export async function cancelOrderById(
  orderId: string,
  userId: string,
): Promise<{
  orderId: string;
  status: string;
  cancelledAt: Date;
  releasedItems: Array<{ ticket_type_id: string; quantity: number }>;
}> {
  type OrderItemsRow = {
    orderId: string;
    userId: string;
    orderStatus: string;
    itemId: string;
    ticketTypeId: string;
    quantity: number;
  };

  let releasedTicketTypeIds: string[] = [];

  const result = await prisma.$transaction(
    async (tx) => {
      const rows = await tx.$queryRaw<OrderItemsRow[]>(Prisma.sql`
      SELECT
        o.id AS "orderId",
        o.user_id AS "userId",
        o.status::text AS "orderStatus",
        oi.id AS "itemId",
        oi.ticket_type_id AS "ticketTypeId",
        oi.quantity
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      WHERE o.id = ${orderId}::uuid
      FOR UPDATE OF o
    `);

      if (rows.length === 0) {
        throw new ApiError({
          title: "ORDER_NOT_FOUND",
          status: 404,
          code: "ORDER_NOT_FOUND",
          detail: "Order not found",
        });
      }

      const { orderStatus, userId: orderUserId } = rows[0];

      if (orderUserId !== userId) {
        throw new ApiError({
          title: "ORDER_ACCESS_DENIED",
          status: 403,
          code: "ORDER_ACCESS_DENIED",
          detail: "Access denied to this order",
        });
      }

      if (orderStatus !== OrderStatus.HELD) {
        throw new ApiError({
          title: "ORDER_ALREADY_FINALIZED",
          status: 409,
          code: "ORDER_ALREADY_FINALIZED",
          detail: `Order is in status ${orderStatus} and cannot be cancelled`,
        });
      }

      const now = new Date();

      await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.CANCELLED,
          cancelledAt: now,
          cancelledReason: "USER_CANCELLED",
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

        await tx.$executeRaw(Prisma.sql`
        UPDATE user_ticket_type_counters utc
        SET held_quantity = GREATEST(0, utc.held_quantity - ${row.quantity})
        FROM orders o
        WHERE o.id = ${orderId}::uuid
          AND utc.user_id = o.user_id
          AND utc.ticket_type_id = ${row.ticketTypeId}::uuid
      `);

        releasedItems.push({
          ticket_type_id: row.ticketTypeId,
          quantity: row.quantity,
        });
      }

      releasedTicketTypeIds = releasedItems.map((i) => i.ticket_type_id);

      return {
        orderId,
        status: OrderStatus.CANCELLED,
        cancelledAt: now,
        releasedItems,
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );

  await Promise.allSettled(
    releasedTicketTypeIds.map((id) => cacheDelete(inventoryCacheKey(id))),
  );

  return result;
}

export async function expireOrderById(orderId: string): Promise<{
  orderId: string;
  status: string;
  releasedItems: Array<{ ticket_type_id: string; quantity: number }>;
}> {
  type OrderItemsRow = {
    orderId: string;
    orderStatus: string;
    itemId: string;
    ticketTypeId: string;
    quantity: number;
  };

  let releasedTicketTypeIds: string[] = [];

  const result = await prisma.$transaction(
    async (tx) => {
      const rows = await tx.$queryRaw<OrderItemsRow[]>(Prisma.sql`
      SELECT
        o.id AS "orderId",
        o.status::text AS "orderStatus",
        oi.id AS "itemId",
        oi.ticket_type_id AS "ticketTypeId",
        oi.quantity
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      WHERE o.id = ${orderId}::uuid
      FOR UPDATE OF o
    `);

      if (rows.length === 0) {
        throw new ApiError({
          title: "ORDER_NOT_FOUND",
          status: 404,
          code: "ORDER_NOT_FOUND",
          detail: "Order not found",
        });
      }

      const { orderStatus } = rows[0];

      // Idempotent: already expired/cancelled/confirmed
      if (orderStatus !== OrderStatus.HELD) {
        return {
          orderId,
          status: orderStatus,
          releasedItems: [],
        };
      }

      const now = new Date();

      await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.EXPIRED,
          expiredAt: now,
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

        await tx.$executeRaw(Prisma.sql`
        UPDATE user_ticket_type_counters utc
        SET held_quantity = GREATEST(0, utc.held_quantity - ${row.quantity})
        FROM orders o
        WHERE o.id = ${orderId}::uuid
          AND utc.user_id = o.user_id
          AND utc.ticket_type_id = ${row.ticketTypeId}::uuid
      `);

        releasedItems.push({
          ticket_type_id: row.ticketTypeId,
          quantity: row.quantity,
        });
      }

      releasedTicketTypeIds = releasedItems.map((i) => i.ticket_type_id);

      return {
        orderId,
        status: OrderStatus.EXPIRED,
        releasedItems,
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );

  await Promise.allSettled(
    releasedTicketTypeIds.map((id) => cacheDelete(inventoryCacheKey(id))),
  );

  return result;
}

export async function findAdminOrders(query: AdminOrdersQuery): Promise<{
  rows: AdminOrderRow[];
  nextCursor: string | null;
}> {
  const limit = Math.min(query.limit ?? 20, 100);
  const fetchLimit = limit + 1;

  let cursorCreatedAt: Date | null = null;
  let cursorId: string | null = null;

  if (query.cursor) {
    try {
      const decoded = Buffer.from(query.cursor, "base64url").toString("utf8");
      const [isoStr, id] = decoded.split(":");
      cursorCreatedAt = new Date(isoStr);
      cursorId = id;
    } catch {
      throw new ApiError({
        title: "INVALID_CHECKOUT_REQUEST",
        status: 400,
        code: "INVALID_CHECKOUT_REQUEST",
        detail: "Invalid cursor",
      });
    }
  }

  const conditions: Prisma.Sql[] = [];

  if (query.concert_id) {
    conditions.push(Prisma.sql`o.concert_id = ${query.concert_id}::uuid`);
  }
  if (query.status) {
    conditions.push(Prisma.sql`o.status::text = ${query.status}`);
  }
  if (query.user_id) {
    conditions.push(Prisma.sql`o.user_id = ${query.user_id}::uuid`);
  }
  if (query.from) {
    conditions.push(Prisma.sql`o.created_at >= ${new Date(query.from)}`);
  }
  if (query.to) {
    conditions.push(Prisma.sql`o.created_at <= ${new Date(query.to)}`);
  }
  if (cursorCreatedAt && cursorId) {
    conditions.push(
      Prisma.sql`(o.created_at, o.id) < (${cursorCreatedAt}, ${cursorId}::uuid)`,
    );
  }

  const whereClause =
    conditions.length > 0
      ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`
      : Prisma.sql``;

  const rows = await prisma.$queryRaw<AdminOrderRow[]>(Prisma.sql`
    SELECT
      o.id,
      o.user_id AS "userId",
      o.concert_id AS "concertId",
      o.status::text AS "status",
      o.total_amount::text AS "totalAmount",
      o.currency,
      o.hold_expires_at AS "holdExpiresAt",
      o.confirmed_at AS "confirmedAt",
      o.cancelled_at AS "cancelledAt",
      o.expired_at AS "expiredAt",
      o.cancelled_reason AS "cancelledReason",
      o.created_at AS "createdAt",
      o.updated_at AS "updatedAt"
    FROM orders o
    ${whereClause}
    ORDER BY o.created_at DESC, o.id DESC
    LIMIT ${fetchLimit}
  `);

  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;

  let nextCursor: string | null = null;
  if (hasMore && data.length > 0) {
    const last = data[data.length - 1];
    const raw = `${last.createdAt.toISOString()}:${last.id}`;
    nextCursor = Buffer.from(raw).toString("base64url");
  }

  return { rows: data, nextCursor };
}
