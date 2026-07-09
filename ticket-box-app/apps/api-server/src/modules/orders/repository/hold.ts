import { OrderStatus, Prisma, TicketTypeStatus } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@ticketbox/database";
import { withSerializableRetry } from "./serializable-retry.js";



// ---------------------------------------------------------------------------
// hold.ts — Nghiệp vụ "tạo Order + giữ vé" (nguồn sự thật duy nhất).
// createHeldOrder thay cho các bản trùng: inventory.holdInventory,
// orders.createOrderHeld. Caller chỉ là wrapper mỏng, map typed error sang HTTP.
// ---------------------------------------------------------------------------

type UserTicketCounterRow = {
  heldQuantity: number;
  paidQuantity: number;
};

type ReservedInventoryRow = {
  availableQuantityAfter: number;
};

type HeldOrderTicketTypeRow = {
  id: string;
  concertId: string;
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

export type InventoryReservationErrorCode =
  | "INVALID_QUANTITY"
  | "INVALID_EXPIRATION"
  | "DUPLICATE_ITEMS"
  | "TICKET_TYPE_NOT_FOUND"
  | "TICKET_TYPE_NOT_ON_SALE"
  | "SALE_WINDOW_CLOSED"
  | "INSUFFICIENT_INVENTORY"
  | "MAX_PER_USER_EXCEEDED";

export class InventoryReservationError extends Error {
  constructor(
    public readonly code: InventoryReservationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "InventoryReservationError";
  }
}

export type CreateHeldOrderItemInput = {
  ticketTypeId: string;
  quantity: number;
};

export type CreateHeldOrderInput = {
  userId: string;
  concertId: string;
  items: CreateHeldOrderItemInput[];
  holdExpiresAt: Date;
  idempotencyKey: string;
  now?: Date;
};

export type CreateHeldOrderItemResult = {
  orderItemId: string;
  ticketTypeId: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
  availableQuantityAfter: number;
};

export type CreateHeldOrderResult = {
  orderId: string;
  userId: string;
  concertId: string;
  status: string;
  totalAmount: string;
  currency: string;
  holdExpiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  items: CreateHeldOrderItemResult[];
};

// ---------------------------------------------------------------------------
// Kết quả CTE cho trường hợp N=1 ticket type.
// ---------------------------------------------------------------------------
type SingleItemCteRow = {
  orderId: string;
  orderItemId: string;
  availableAfter: number | null;
  counterUpdated: bigint;
  ttStatus: string | null;
  ttConcertId: string | null;
  saleStartAt: Date | null;
  saleEndAt: Date | null;
  availableBefore: number | null;
  price: string | null;
  currency: string | null;
};

// ---------------------------------------------------------------------------
// Tạo order + giữ vé bằng 1 CTE duy nhất cho N=1 ticket type.
// Giảm 6 round-trip tuần tự xuống còn 1 round-trip.
// ---------------------------------------------------------------------------
async function createHeldOrderSingleItem(
  tx: Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0],
  input: CreateHeldOrderInput,
  item: CreateHeldOrderItemInput,
  now: Date,
): Promise<CreateHeldOrderResult> {
  const totalAmount = new Prisma.Decimal(0); // tính trong CTE

  const rows = await tx.$queryRaw<SingleItemCteRow[]>(Prisma.sql`
    WITH
      -- 1. Đọc thông tin ticket type (không lock).
      tt AS (
        SELECT
          id,
          concert_id,
          total_quantity,
          held_quantity,
          sold_quantity,
          max_per_user,
          price,
          currency,
          sale_start_at,
          sale_end_at,
          status
        FROM ticket_types
        WHERE id = ${item.ticketTypeId}::uuid
      ),
      -- 2. Upsert counter: INSERT lần đầu hoặc UPDATE tăng counter.
      -- PostgreSQL đảm bảo INSERT và ON CONFLICT DO UPDATE đều kiểm tra
      -- max_per_user. Dùng WHERE clause trong DO UPDATE để giữ atomic check.
      upsert_counter AS (
        INSERT INTO user_ticket_type_counters (user_id, ticket_type_id, held_quantity, paid_quantity)
        SELECT
          ${input.userId}::uuid,
          ${item.ticketTypeId}::uuid,
          ${item.quantity},
          0
        FROM tt
        WHERE ${item.quantity} <= (SELECT max_per_user FROM tt)
        ON CONFLICT (user_id, ticket_type_id) DO UPDATE
          SET held_quantity = user_ticket_type_counters.held_quantity + ${item.quantity}
          WHERE user_ticket_type_counters.held_quantity
                  + user_ticket_type_counters.paid_quantity
                  + ${item.quantity}
                  <= (SELECT max_per_user FROM tt)
        RETURNING held_quantity, paid_quantity
      ),
      -- 4. Tạo order (chỉ chạy nếu counter update thành công).
      new_order AS (
        INSERT INTO orders (
          id, user_id, concert_id, idempotency_key, status,
          hold_expires_at, total_amount, currency,
          created_at, updated_at
        )
        SELECT
          gen_random_uuid(),
          ${input.userId}::uuid,
          ${input.concertId}::uuid,
          ${input.idempotencyKey},
          'HELD'::order_status,
          ${input.holdExpiresAt},
          (SELECT price FROM tt) * ${item.quantity},
          (SELECT currency FROM tt),
          ${now},
          ${now}
        WHERE EXISTS (SELECT 1 FROM upsert_counter)
        RETURNING id, created_at, updated_at, total_amount, currency
      ),
      -- 5. Tạo order item (chỉ chạy nếu order được tạo).
      new_order_item AS (
        INSERT INTO order_items (
          id, order_id, ticket_type_id, quantity, unit_price, line_total, created_at
        )
        SELECT
          gen_random_uuid(),
          (SELECT id FROM new_order),
          ${item.ticketTypeId}::uuid,
          ${item.quantity},
          (SELECT price FROM tt),
          (SELECT price FROM tt) * ${item.quantity},
          ${now}
        WHERE EXISTS (SELECT 1 FROM new_order)
        RETURNING id
      ),
      -- 6. Cập nhật inventory atomically — điểm quyết định không oversell.
      -- PostgreSQL ở READ COMMITTED chờ concurrent update rồi re-evaluate WHERE.
      reserved AS (
        UPDATE ticket_types
        SET held_quantity = held_quantity + ${item.quantity}
        WHERE id = ${item.ticketTypeId}::uuid
          AND concert_id = ${input.concertId}::uuid
          AND status = ${TicketTypeStatus.ON_SALE}::ticket_type_status
          AND sale_start_at <= ${now}
          AND sale_end_at >= ${now}
          AND total_quantity - held_quantity - sold_quantity >= ${item.quantity}
          AND EXISTS (SELECT 1 FROM new_order_item)
        RETURNING total_quantity - held_quantity - sold_quantity AS available_after
      )
    SELECT
      (SELECT id             FROM new_order)      AS "orderId",
      (SELECT id             FROM new_order_item) AS "orderItemId",
      (SELECT available_after FROM reserved)       AS "availableAfter",
      (SELECT COUNT(*)       FROM upsert_counter)::bigint AS "counterUpdated",
      (SELECT status::text   FROM tt)             AS "ttStatus",
      (SELECT concert_id::text FROM tt)           AS "ttConcertId",
      (SELECT sale_start_at  FROM tt)             AS "saleStartAt",
      (SELECT sale_end_at    FROM tt)             AS "saleEndAt",
      (SELECT total_quantity - held_quantity - sold_quantity FROM tt) AS "availableBefore",
      (SELECT price::text    FROM tt)             AS "price",
      (SELECT currency       FROM tt)             AS "currency"
  `);

  const row = rows[0];

  // --- Phân tích kết quả CTE để ném đúng lỗi nghiệp vụ ---

  // Ticket type không tồn tại.
  if (row.ttStatus === null) {
    throw new InventoryReservationError(
      "TICKET_TYPE_NOT_FOUND",
      `Ticket type ${item.ticketTypeId} not found.`,
    );
  }

  // Concert không khớp hoặc trạng thái không phải ON_SALE.
  if (
    row.ttConcertId !== input.concertId ||
    row.ttStatus !== TicketTypeStatus.ON_SALE
  ) {
    throw new InventoryReservationError(
      "TICKET_TYPE_NOT_ON_SALE",
      `Ticket type ${item.ticketTypeId} is not on sale.`,
    );
  }

  // Ngoài cửa sổ bán vé.
  if (
    row.saleStartAt === null ||
    row.saleEndAt === null ||
    now < row.saleStartAt ||
    now > row.saleEndAt
  ) {
    throw new InventoryReservationError(
      "SALE_WINDOW_CLOSED",
      `Ticket type ${item.ticketTypeId} is outside the sale window.`,
    );
  }

  // Counter không được update: vượt max_per_user.
  if (row.counterUpdated === 0n) {
    throw new InventoryReservationError(
      "MAX_PER_USER_EXCEEDED",
      `Purchase would exceed per-user limit for ticket type ${item.ticketTypeId}.`,
    );
  }

  // Inventory update thất bại: hết vé tại thời điểm UPDATE.
  if (row.availableAfter === null || row.orderId === null) {
    // Phân biệt hết vé vs lỗi khác.
    if (row.availableBefore !== null && row.availableBefore < item.quantity) {
      throw new InventoryReservationError(
        "INSUFFICIENT_INVENTORY",
        `Not enough available tickets for type ${item.ticketTypeId}.`,
      );
    }
    throw new InventoryReservationError(
      "INSUFFICIENT_INVENTORY",
      `Not enough available tickets for type ${item.ticketTypeId}.`,
    );
  }

  const price = row.price!;
  const currency = row.currency!;
  const unitPrice = new Prisma.Decimal(price);
  const lineTotal = unitPrice.times(item.quantity);
  const totalAmountFinal = lineTotal;

  return {
    orderId: row.orderId,
    userId: input.userId,
    concertId: input.concertId,
    status: OrderStatus.HELD,
    totalAmount: totalAmountFinal.toString(),
    currency,
    holdExpiresAt: input.holdExpiresAt,
    createdAt: now,
    updatedAt: now,
    items: [
      {
        orderItemId: row.orderItemId,
        ticketTypeId: item.ticketTypeId,
        quantity: item.quantity,
        unitPrice: unitPrice.toString(),
        lineTotal: lineTotal.toString(),
        availableQuantityAfter: row.availableAfter,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Fallback: luồng tuần tự gốc cho N > 1 ticket type.
// ---------------------------------------------------------------------------
async function createHeldOrderMultiItem(
  tx: Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0],
  input: CreateHeldOrderInput,
  sortedItems: CreateHeldOrderItemInput[],
  now: Date,
): Promise<CreateHeldOrderResult> {
  const ticketTypeIds = sortedItems.map((i) => i.ticketTypeId);

  const ticketTypes = await tx.$queryRaw<HeldOrderTicketTypeRow[]>(Prisma.sql`
    SELECT
      id,
      concert_id AS "concertId",
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
  `);

  if (ticketTypes.length !== ticketTypeIds.length) {
    throw new InventoryReservationError(
      "TICKET_TYPE_NOT_FOUND",
      "One or more ticket types not found.",
    );
  }

  const typeMap = new Map(ticketTypes.map((t) => [t.id, t]));

  // Validate trạng thái, thời gian bán, và số lượng còn lại.
  for (const item of sortedItems) {
    const tt = typeMap.get(item.ticketTypeId)!;

    if (tt.concertId !== input.concertId) {
      throw new InventoryReservationError(
        "TICKET_TYPE_NOT_ON_SALE",
        `Ticket type ${item.ticketTypeId} does not belong to concert.`,
      );
    }
    if (tt.status !== TicketTypeStatus.ON_SALE) {
      throw new InventoryReservationError(
        "TICKET_TYPE_NOT_ON_SALE",
        `Ticket type ${item.ticketTypeId} is not on sale.`,
      );
    }
    if (now < tt.saleStartAt || now > tt.saleEndAt) {
      throw new InventoryReservationError(
        "SALE_WINDOW_CLOSED",
        `Ticket type ${item.ticketTypeId} is outside the sale window.`,
      );
    }

    const available =
      tt.totalQuantity - tt.heldQuantity - tt.soldQuantity;
    if (available < item.quantity) {
      throw new InventoryReservationError(
        "INSUFFICIENT_INVENTORY",
        `Not enough available tickets for type ${item.ticketTypeId}.`,
      );
    }
  }

  // Tăng quota atomically. Mỗi user có counter riêng nên bước này không
  // tạo hot row giữa các user khác nhau.
  for (const item of sortedItems) {
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO user_ticket_type_counters (user_id, ticket_type_id, held_quantity, paid_quantity)
      VALUES (${input.userId}::uuid, ${item.ticketTypeId}::uuid, 0, 0)
      ON CONFLICT (user_id, ticket_type_id) DO NOTHING
    `);

    const tt = typeMap.get(item.ticketTypeId)!;
    const counters = await tx.$queryRaw<UserTicketCounterRow[]>(Prisma.sql`
      UPDATE user_ticket_type_counters
      SET held_quantity = held_quantity + ${item.quantity}
      WHERE user_id = ${input.userId}::uuid
        AND ticket_type_id = ${item.ticketTypeId}::uuid
        AND held_quantity + paid_quantity + ${item.quantity} <= ${tt.maxPerUser}
      RETURNING
        held_quantity AS "heldQuantity",
        paid_quantity AS "paidQuantity"
    `);

    if (counters.length === 0) {
      throw new InventoryReservationError(
        "MAX_PER_USER_EXCEEDED",
        `Purchase would exceed per-user limit for ticket type ${item.ticketTypeId}.`,
      );
    }
  }

  // Tổng tiền.
  let totalAmount = new Prisma.Decimal(0);
  for (const item of sortedItems) {
    const tt = typeMap.get(item.ticketTypeId)!;
    totalAmount = totalAmount.plus(
      new Prisma.Decimal(tt.price).times(item.quantity),
    );
  }

  const currency = typeMap.get(sortedItems[0].ticketTypeId)!.currency;

  // Tạo order.
  const order = await tx.order.create({
    data: {
      userId: input.userId,
      concertId: input.concertId,
      idempotencyKey: input.idempotencyKey,
      status: OrderStatus.HELD,
      holdExpiresAt: input.holdExpiresAt,
      totalAmount,
      currency,
    },
  });

  const items: CreateHeldOrderItemResult[] = [];

  for (const item of sortedItems) {
    const tt = typeMap.get(item.ticketTypeId)!;
    const unitPrice = new Prisma.Decimal(tt.price);
    const lineTotal = unitPrice.times(item.quantity);

    const orderItem = await tx.orderItem.create({
      data: {
        orderId: order.id,
        ticketTypeId: item.ticketTypeId,
        quantity: item.quantity,
        unitPrice,
        lineTotal,
      },
    });

    // Conditional UPDATE là điểm quyết định inventory. Ở READ COMMITTED,
    // PostgreSQL sẽ chờ transaction đang giữ row kết thúc rồi đánh giá
    // lại WHERE trên phiên bản mới nhất, nhờ đó không oversell và không
    // tạo serialization failure 40001 như SELECT FOR UPDATE trước đây.
    const reserved = await tx.$queryRaw<ReservedInventoryRow[]>(Prisma.sql`
      UPDATE ticket_types
      SET held_quantity = held_quantity + ${item.quantity}
      WHERE id = ${item.ticketTypeId}::uuid
        AND concert_id = ${input.concertId}::uuid
        AND status = ${TicketTypeStatus.ON_SALE}::ticket_type_status
        AND sale_start_at <= ${now}
        AND sale_end_at >= ${now}
        AND total_quantity - held_quantity - sold_quantity >= ${item.quantity}
      RETURNING
        total_quantity - held_quantity - sold_quantity AS "availableQuantityAfter"
    `);

    if (reserved.length === 0) {
      // Initial validation đã phân loại not-found/status/window. Nếu row
      // đổi trong lúc transaction chạy, đọc lại để giữ đúng API error;
      // trường hợp thông thường ở flash sale là inventory vừa hết.
      const [current] = await tx.$queryRaw<HeldOrderTicketTypeRow[]>(Prisma.sql`
        SELECT
          id,
          concert_id AS "concertId",
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
        WHERE id = ${item.ticketTypeId}::uuid
      `);

      if (!current) {
        throw new InventoryReservationError(
          "TICKET_TYPE_NOT_FOUND",
          `Ticket type ${item.ticketTypeId} not found.`,
        );
      }
      if (
        current.concertId !== input.concertId ||
        current.status !== TicketTypeStatus.ON_SALE
      ) {
        throw new InventoryReservationError(
          "TICKET_TYPE_NOT_ON_SALE",
          `Ticket type ${item.ticketTypeId} is not on sale.`,
        );
      }
      if (now < current.saleStartAt || now > current.saleEndAt) {
        throw new InventoryReservationError(
          "SALE_WINDOW_CLOSED",
          `Ticket type ${item.ticketTypeId} is outside the sale window.`,
        );
      }
      throw new InventoryReservationError(
        "INSUFFICIENT_INVENTORY",
        `Not enough available tickets for type ${item.ticketTypeId}.`,
      );
    }

    items.push({
      orderItemId: orderItem.id,
      ticketTypeId: item.ticketTypeId,
      quantity: item.quantity,
      unitPrice: unitPrice.toString(),
      lineTotal: lineTotal.toString(),
      availableQuantityAfter: reserved[0].availableQuantityAfter,
    });
  }

  return {
    orderId: order.id,
    userId: order.userId,
    concertId: order.concertId,
    status: order.status,
    totalAmount: order.totalAmount.toString(),
    currency: order.currency,
    holdExpiresAt: order.holdExpiresAt!,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    items,
  };
}

// ---------------------------------------------------------------------------
// Entry point công khai.
// ---------------------------------------------------------------------------
export async function createHeldOrder(
  input: CreateHeldOrderInput,
  db: PrismaClient = prisma,
): Promise<CreateHeldOrderResult> {
  const now = input.now ?? new Date();

  if (input.items.length === 0) {
    throw new InventoryReservationError(
      "INVALID_QUANTITY",
      "Order must contain at least one item.",
    );
  }

  for (const item of input.items) {
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new InventoryReservationError(
        "INVALID_QUANTITY",
        "Reservation quantity must be a positive integer.",
      );
    }
  }

  if (input.holdExpiresAt <= now) {
    throw new InventoryReservationError(
      "INVALID_EXPIRATION",
      "Hold expiration must be in the future.",
    );
  }

  const uniqueIds = new Set(input.items.map((i) => i.ticketTypeId));
  if (uniqueIds.size !== input.items.length) {
    throw new InventoryReservationError(
      "DUPLICATE_ITEMS",
      "Items must not contain duplicate ticket types.",
    );
  }

  // Sort để mọi transaction cập nhật nhiều ticket type theo cùng thứ tự.
  const sortedItems = [...input.items].sort((a, b) =>
    a.ticketTypeId.localeCompare(b.ticketTypeId),
  );

  return withSerializableRetry(() =>
    db.$transaction(
      async (tx) => {
        // N=1: dùng đường CTE tối ưu (1 round-trip).
        if (sortedItems.length === 1) {
          return createHeldOrderSingleItem(tx, input, sortedItems[0], now);
        }
        // N>1: fallback về luồng tuần tự đã kiểm chứng.
        return createHeldOrderMultiItem(tx, input, sortedItems, now);
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        // Prisma mặc định chỉ chờ 2 giây để lấy transaction từ pool. Trong
        // flash sale, transaction ngắn vẫn có thể phải xếp hàng; cho phép chờ
        // có giới hạn thay vì biến queueing hợp lệ thành P2028/HTTP 500.
        maxWait: 10_000,
        timeout: 15_000,
      },
    ),
  );
}
