import {
  prisma,
  Prisma,
  releaseHeldOrder,
} from "@ticketbox/database";
import { cacheDelete, catalogCacheKeys } from "@ticketbox/redis";
import { env } from "@ticketbox/config";
import { ApiError } from "../../../shared/http/problem-details.js";
import type {
  CreateOrderRequest,
  AdminOrderRow,
  AdminOrdersQuery,
} from "../order.type.js";
import { createHeldOrder, InventoryReservationError } from "./hold.js";

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

export async function getUserTicketQuotas(userId: string, concertId: string) {
  const ticketTypes = await prisma.ticketType.findMany({
    where: { concertId },
    select: {
      id: true,
      maxPerUser: true,
      counters: {
        where: { userId },
        select: {
          heldQuantity: true,
          paidQuantity: true,
        },
        take: 1,
      },
    },
    orderBy: [{ price: 'asc' }, { name: 'asc' }],
  });

  return ticketTypes.map((ticketType) => {
    const counter = ticketType.counters[0];
    const heldQuantity = counter?.heldQuantity ?? 0;
    const paidQuantity = counter?.paidQuantity ?? 0;

    return {
      ticketTypeId: ticketType.id,
      maxPerUser: ticketType.maxPerUser,
      heldQuantity,
      paidQuantity,
      remainingQuantity: Math.max(
        ticketType.maxPerUser - heldQuantity - paidQuantity,
        0,
      ),
    };
  });
}

// Map typed InventoryReservationError (từ createHeldOrder) sang ApiError của
// module orders. Lỗi khác (kể cả P2002 idempotency) propagate nguyên vẹn để
// service createOrder xử lý replay.
function mapReservationErrorToApi(err: unknown): unknown {
  if (!(err instanceof InventoryReservationError)) return err;
  switch (err.code) {
    case "TICKET_TYPE_NOT_FOUND":
      return new ApiError({
        title: "TICKET_TYPE_NOT_FOUND",
        status: 404,
        code: "TICKET_TYPE_NOT_FOUND",
        detail: err.message,
      });
    case "TICKET_TYPE_NOT_ON_SALE":
      return new ApiError({
        title: "TICKET_TYPE_NOT_ON_SALE",
        status: 422,
        code: "TICKET_TYPE_NOT_ON_SALE",
        detail: err.message,
      });
    // Tách khỏi NOT_ON_SALE: vé hợp lệ nhưng ngoài khung giờ bán (chưa mở/đã đóng)
    // để FE hiển thị đúng "chưa tới giờ mở bán" thay vì "vé không mở bán".
    case "SALE_WINDOW_CLOSED":
      return new ApiError({
        title: "SALE_WINDOW_CLOSED",
        status: 422,
        code: "SALE_WINDOW_CLOSED",
        detail: err.message,
      });
    case "INSUFFICIENT_INVENTORY":
      return new ApiError({
        title: "TICKET_SOLD_OUT",
        status: 409,
        code: "TICKET_SOLD_OUT",
        detail: err.message,
      });
    case "MAX_PER_USER_EXCEEDED":
      return new ApiError({
        title: "PER_USER_LIMIT_EXCEEDED",
        status: 409,
        code: "PER_USER_LIMIT_EXCEEDED",
        detail: err.message,
      });
    default:
      // INVALID_QUANTITY / DUPLICATE_ITEMS / INVALID_EXPIRATION — thường đã bị
      // Zod chặn trước; map phòng thủ.
      return new ApiError({
        title: "VALIDATION_ERROR",
        status: 422,
        code: "VALIDATION_ERROR",
        detail: err.message,
      });
  }
}

// Wrapper mỏng quanh nguồn sự thật createHeldOrder (@ticketbox/database).
// Chính sách hold của orders: server tự đặt hạn giữ theo env.order.holdDurationSeconds.
export async function createOrderHeld(
  userId: string,
  req: CreateOrderRequest,
  idempotencyKey: string,
): Promise<CreateOrderResult> {
  let result;
  try {
    result = await createHeldOrder({
      userId,
      concertId: req.concert_id,
      items: req.items.map((i) => ({
        ticketTypeId: i.ticket_type_id,
        quantity: i.quantity,
      })),
      holdExpiresAt: new Date(Date.now() + env.order.holdDurationSeconds * 1000),
      idempotencyKey,
    });
  } catch (err) {
    throw mapReservationErrorToApi(err);
  }

  await cacheDelete(catalogCacheKeys.inventory(result.concertId));

  return {
    order: {
      id: result.orderId,
      userId: result.userId,
      concertId: result.concertId,
      status: result.status,
      totalAmount: result.totalAmount,
      currency: result.currency,
      holdExpiresAt: result.holdExpiresAt,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    },
    items: result.items.map((i) => ({
      id: i.orderItemId,
      ticketTypeId: i.ticketTypeId,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      lineTotal: i.lineTotal,
    })),
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
  userId: string,
  idempotencyKey: string,
): Promise<{ id: string; status: string } | null> {
  const [row] = await prisma.$queryRaw<
    Array<{ id: string; status: string }>
  >(Prisma.sql`
    SELECT id, status::text AS "status"
    FROM orders
    WHERE user_id = ${userId}::uuid
      AND idempotency_key = ${idempotencyKey}
  `);

  return row ?? null;
}

// Wrapper mỏng quanh releaseHeldOrder. Ownership check chạy nguyên tử trong
// transaction qua callback authorize; not-held -> 409 ORDER_ALREADY_FINALIZED.
export async function cancelOrderById(
  orderId: string,
  userId: string,
): Promise<{
  orderId: string;
  status: string;
  cancelledAt: Date;
  releasedItems: Array<{ ticket_type_id: string; quantity: number }>;
}> {
  const result = await releaseHeldOrder({
    orderId,
    reason: "USER_CANCELLED",
    authorize: (order) => {
      if (order.userId !== userId) {
        throw new ApiError({
          title: "ORDER_ACCESS_DENIED",
          status: 403,
          code: "ORDER_ACCESS_DENIED",
          detail: "Access denied to this order",
        });
      }
    },
  });

  if (result.outcome === "NOT_FOUND") {
    throw new ApiError({
      title: "ORDER_NOT_FOUND",
      status: 404,
      code: "ORDER_NOT_FOUND",
      detail: "Order not found",
    });
  }
  if (result.outcome === "NOT_HELD") {
    throw new ApiError({
      title: "ORDER_ALREADY_FINALIZED",
      status: 409,
      code: "ORDER_ALREADY_FINALIZED",
      detail: `Order is in status ${result.status} and cannot be cancelled`,
    });
  }

  const releasedItems = result.releasedItems.map((i) => ({
    ticket_type_id: i.ticketTypeId,
    quantity: i.quantity,
  }));

  if (result.concertId) {
    await cacheDelete(catalogCacheKeys.inventory(result.concertId));
  }

  return {
    orderId: result.orderId,
    status: result.status,
    cancelledAt: result.timestamp!,
    releasedItems,
  };
}

// Wrapper mỏng quanh releaseHeldOrder. not-held -> idempotent (trả trạng thái
// hiện tại, không lỗi); chỉ not-found mới ném 404.
export async function expireOrderById(orderId: string): Promise<{
  orderId: string;
  status: string;
  releasedItems: Array<{ ticket_type_id: string; quantity: number }>;
}> {
  const result = await releaseHeldOrder({ orderId, reason: "HOLD_EXPIRED" });

  if (result.outcome === "NOT_FOUND") {
    throw new ApiError({
      title: "ORDER_NOT_FOUND",
      status: 404,
      code: "ORDER_NOT_FOUND",
      detail: "Order not found",
    });
  }

  const releasedItems = result.releasedItems.map((i) => ({
    ticket_type_id: i.ticketTypeId,
    quantity: i.quantity,
  }));

  if (result.concertId) {
    await cacheDelete(catalogCacheKeys.inventory(result.concertId));
  }

  return {
    orderId: result.orderId,
    status: result.status,
    releasedItems,
  };
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
