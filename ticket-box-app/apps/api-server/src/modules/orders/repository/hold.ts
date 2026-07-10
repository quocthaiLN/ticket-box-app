import { OrderStatus, Prisma, TicketTypeStatus } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@ticketbox/database";
import { withSerializableRetry } from "./serializable-retry.js";



// ---------------------------------------------------------------------------
// hold.ts — Nghiệp vụ "tạo Order + giữ vé" (nguồn sự thật duy nhất).
// createHeldOrder thay cho các bản trùng: inventory.holdInventory,
// orders.createOrderHeld. Caller chỉ là wrapper mỏng, map typed error sang HTTP.
// ---------------------------------------------------------------------------

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

type QueryClient = Pick<PrismaClient, "$queryRaw">;

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

type MultiItemCteResultItem = {
  orderItemId: string;
  ticketTypeId: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
  availableQuantityAfter: number;
};

type MultiItemCteRow = {
  orderId: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  totalAmount: string | null;
  currency: string | null;
  itemCount: bigint;
  typeCount: bigint;
  invalidSaleCount: bigint;
  invalidWindowCount: bigint;
  counterCount: bigint;
  reservedCount: bigint;
  items: MultiItemCteResultItem[];
};

// ---------------------------------------------------------------------------
// Tạo order + giữ vé bằng 1 CTE duy nhất cho N=1 ticket type.
// Giảm 6 round-trip tuần tự xuống còn 1 round-trip.
// ---------------------------------------------------------------------------
async function createHeldOrderSingleItem(
  tx: QueryClient,
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
// N > 1 ticket type: một DB round-trip. Tất cả hot row được lock theo UUID,
// sau đó quota, order, inventory và order item được xử lý trong cùng một CTE.
// Nếu một bước không đủ số item, caller ném lỗi để rollback toàn transaction.
// ---------------------------------------------------------------------------
async function createHeldOrderMultiItemCte(
  tx: QueryClient,
  input: CreateHeldOrderInput,
  sortedItems: CreateHeldOrderItemInput[],
  now: Date,
): Promise<CreateHeldOrderResult> {
  const serializedItems = JSON.stringify(sortedItems);
  const rows = await tx.$queryRaw<MultiItemCteRow[]>(Prisma.sql`
    WITH
      input_items AS MATERIALIZED (
        SELECT
          item."ticketTypeId"::uuid AS ticket_type_id,
          item.quantity::integer AS quantity
        FROM jsonb_to_recordset(${serializedItems}::jsonb)
          AS item("ticketTypeId" text, quantity integer)
        ORDER BY item."ticketTypeId"::uuid
      ),
      locked_ticket_types AS MATERIALIZED (
        SELECT
          tt.id,
          tt.concert_id,
          tt.total_quantity,
          tt.held_quantity,
          tt.sold_quantity,
          tt.max_per_user,
          tt.price,
          tt.currency,
          tt.sale_start_at,
          tt.sale_end_at,
          tt.status
        FROM ticket_types tt
        JOIN input_items i ON i.ticket_type_id = tt.id
        ORDER BY tt.id
        FOR UPDATE OF tt
      ),
      validation AS (
        SELECT
          (SELECT COUNT(*) FROM input_items)::bigint AS item_count,
          COUNT(*)::bigint AS type_count,
          COUNT(*) FILTER (
            WHERE concert_id <> ${input.concertId}::uuid
               OR status <> ${TicketTypeStatus.ON_SALE}::ticket_type_status
          )::bigint AS invalid_sale_count,
          COUNT(*) FILTER (
            WHERE sale_start_at > ${now} OR sale_end_at < ${now}
          )::bigint AS invalid_window_count
        FROM locked_ticket_types
      ),
      upsert_counter AS (
        INSERT INTO user_ticket_type_counters (
          user_id, ticket_type_id, held_quantity, paid_quantity
        )
        SELECT ${input.userId}::uuid, i.ticket_type_id, i.quantity, 0
        FROM input_items i
        JOIN locked_ticket_types tt ON tt.id = i.ticket_type_id
        WHERE (SELECT item_count = type_count FROM validation)
          AND (SELECT invalid_sale_count = 0 FROM validation)
          AND (SELECT invalid_window_count = 0 FROM validation)
          AND i.quantity <= tt.max_per_user
        ON CONFLICT (user_id, ticket_type_id) DO UPDATE
          SET held_quantity = user_ticket_type_counters.held_quantity + EXCLUDED.held_quantity
          WHERE user_ticket_type_counters.held_quantity
                  + user_ticket_type_counters.paid_quantity
                  + EXCLUDED.held_quantity
                <= (
                  SELECT max_per_user
                  FROM locked_ticket_types
                  WHERE id = EXCLUDED.ticket_type_id
                )
        RETURNING ticket_type_id
      ),
      new_order AS (
        INSERT INTO orders (
          id, user_id, concert_id, idempotency_key, status,
          hold_expires_at, total_amount, currency, created_at, updated_at
        )
        SELECT
          gen_random_uuid(),
          ${input.userId}::uuid,
          ${input.concertId}::uuid,
          ${input.idempotencyKey},
          'HELD'::order_status,
          ${input.holdExpiresAt},
          SUM(tt.price * i.quantity),
          MIN(tt.currency),
          ${now},
          ${now}
        FROM input_items i
        JOIN locked_ticket_types tt ON tt.id = i.ticket_type_id
        HAVING (SELECT COUNT(*) FROM upsert_counter)
                 = (SELECT item_count FROM validation)
        RETURNING id, created_at, updated_at, total_amount, currency
      ),
      reserved AS (
        UPDATE ticket_types tt
        SET held_quantity = tt.held_quantity + i.quantity
        FROM input_items i
        WHERE tt.id = i.ticket_type_id
          AND tt.concert_id = ${input.concertId}::uuid
          AND tt.status = ${TicketTypeStatus.ON_SALE}::ticket_type_status
          AND tt.sale_start_at <= ${now}
          AND tt.sale_end_at >= ${now}
          AND tt.total_quantity - tt.held_quantity - tt.sold_quantity >= i.quantity
          AND EXISTS (SELECT 1 FROM new_order)
        RETURNING
          tt.id AS ticket_type_id,
          tt.total_quantity - tt.held_quantity - tt.sold_quantity AS available_after
      ),
      new_order_items AS (
        INSERT INTO order_items (
          id, order_id, ticket_type_id, quantity, unit_price, line_total, created_at
        )
        SELECT
          gen_random_uuid(),
          (SELECT id FROM new_order),
          i.ticket_type_id,
          i.quantity,
          tt.price,
          tt.price * i.quantity,
          ${now}
        FROM input_items i
        JOIN locked_ticket_types tt ON tt.id = i.ticket_type_id
        WHERE (SELECT COUNT(*) FROM reserved)
                = (SELECT item_count FROM validation)
        RETURNING id, ticket_type_id, quantity, unit_price, line_total
      )
    SELECT
      (SELECT id FROM new_order) AS "orderId",
      (SELECT created_at FROM new_order) AS "createdAt",
      (SELECT updated_at FROM new_order) AS "updatedAt",
      (SELECT total_amount::text FROM new_order) AS "totalAmount",
      (SELECT currency FROM new_order) AS "currency",
      v.item_count AS "itemCount",
      v.type_count AS "typeCount",
      v.invalid_sale_count AS "invalidSaleCount",
      v.invalid_window_count AS "invalidWindowCount",
      (SELECT COUNT(*) FROM upsert_counter)::bigint AS "counterCount",
      (SELECT COUNT(*) FROM reserved)::bigint AS "reservedCount",
      COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'orderItemId', oi.id,
            'ticketTypeId', oi.ticket_type_id,
            'quantity', oi.quantity,
            'unitPrice', oi.unit_price::text,
            'lineTotal', oi.line_total::text,
            'availableQuantityAfter', r.available_after
          )
          ORDER BY oi.ticket_type_id
        )
        FROM new_order_items oi
        JOIN reserved r ON r.ticket_type_id = oi.ticket_type_id
      ), '[]'::jsonb) AS items
    FROM validation v
  `);

  const row = rows[0];
  const itemCount = Number(row.itemCount);

  if (Number(row.typeCount) !== itemCount) {
    throw new InventoryReservationError(
      "TICKET_TYPE_NOT_FOUND",
      "One or more ticket types not found.",
    );
  }
  if (Number(row.invalidSaleCount) > 0) {
    throw new InventoryReservationError(
      "TICKET_TYPE_NOT_ON_SALE",
      "One or more ticket types are not on sale for this concert.",
    );
  }
  if (Number(row.invalidWindowCount) > 0) {
    throw new InventoryReservationError(
      "SALE_WINDOW_CLOSED",
      "One or more ticket types are outside the sale window.",
    );
  }
  if (Number(row.counterCount) !== itemCount) {
    throw new InventoryReservationError(
      "MAX_PER_USER_EXCEEDED",
      "Purchase would exceed the per-user limit for one or more ticket types.",
    );
  }
  if (Number(row.reservedCount) !== itemCount || !row.orderId) {
    throw new InventoryReservationError(
      "INSUFFICIENT_INVENTORY",
      "Not enough available tickets for one or more ticket types.",
    );
  }

  return {
    orderId: row.orderId,
    userId: input.userId,
    concertId: input.concertId,
    status: OrderStatus.HELD,
    totalAmount: row.totalAmount!,
    currency: row.currency!,
    holdExpiresAt: input.holdExpiresAt,
    createdAt: row.createdAt!,
    updatedAt: row.updatedAt!,
    items: row.items,
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

  // Sort để mọi statement cập nhật nhiều ticket type theo cùng thứ tự.
  const sortedItems = [...input.items].sort((a, b) =>
    a.ticketTypeId.localeCompare(b.ticketTypeId),
  );

  // CTE là nguyên tử ở cấp SQL statement, nhưng các kiểm tra kết quả bên dưới
  // statement vẫn có thể ném InventoryReservationError. Phải giữ transaction
  // mở đến khi các kiểm tra đó hoàn tất; nếu không, order/counter được tạo bởi
  // CTE sẽ commit dù inventory reservation thất bại.
  return withSerializableRetry(() =>
    db.$transaction(
      async (tx) => {
        if (sortedItems.length === 1) {
          return createHeldOrderSingleItem(tx, input, sortedItems[0], now);
        }
        return createHeldOrderMultiItemCte(tx, input, sortedItems, now);
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        maxWait: 10_000,
        // Nhỏ hơn admission lease mặc định 60 giây để lease không hết hạn khi
        // transaction còn giữ lock. Timeout luôn rollback toàn bộ thay đổi.
        timeout: 55_000,
      },
    ),
  );
}
