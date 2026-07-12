import { OrderStatus, Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";

import { prisma } from "./client.js";

// ---------------------------------------------------------------------------
// release.ts — Vòng đời order phía sau hold: release / expire.
// releaseHeldOrder là nguồn sự thật duy nhất cho "trả vé của một order HELD",
// thay cho: inventory.releaseInventory, orders.cancelOrderById/expireOrderById,
// và lõi của expireHeldOrder.
// ---------------------------------------------------------------------------

const HOLD_EXPIRED_REASON = "HOLD_EXPIRED";

/**
 * Dưới isolation level Serializable, PostgreSQL có thể abort một transaction khi
 * phát hiện xung đột với transaction chạy song song (serialization failure /
 * deadlock). Đây là lỗi *tạm thời* — cách xử lý đúng là chạy lại transaction.
 */
function isRetryableTxError(err: unknown): boolean {
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === "P2034"
  ) {
    return true;
  }
  const message = err instanceof Error ? err.message : "";
  return message.includes("40001") || message.includes("40P01");
}

async function withSerializableRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 25,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!isRetryableTxError(err) || attempt === maxAttempts) {
        throw err;
      }
      lastError = err;
      const backoff = baseDelayMs * 2 ** (attempt - 1);
      const jitter = Math.random() * baseDelayMs;
      await new Promise((resolve) => setTimeout(resolve, backoff + jitter));
    }
  }
  // Không bao giờ tới đây, nhưng giữ cho TypeScript yên tâm.
  throw lastError;
}

type ExpiredHeldOrderRow = {
  orderId: string;
  holdExpiresAt: Date;
};

type ReleaseOrderRow = {
  orderId: string;
  userId: string;
  concertId: string;
  orderStatus: string;
  ticketTypeId: string;
  quantity: number;
};

// Tìm các order đang HELD nhưng đã quá hạn giữ vé để worker xử lý.
export async function findExpiredHeldOrders(
  limit = 50,
  now = new Date(),
  db: PrismaClient = prisma,
): Promise<ExpiredHeldOrderRow[]> {
  return db.$queryRaw<ExpiredHeldOrderRow[]>(Prisma.sql`
    SELECT
      id AS "orderId",
      hold_expires_at AS "holdExpiresAt"
    FROM orders
    WHERE status = ${OrderStatus.HELD}::order_status
      AND hold_expires_at IS NOT NULL
      -- Cột TIMESTAMP naive lưu theo quy ước UTC (Prisma). Ép param về naive-UTC
      -- trước khi so sánh để không phụ thuộc TimeZone của Postgres server
      -- (server chạy múi giờ khác UTC sẽ làm mọi hold bị coi là quá hạn ngay).
      AND hold_expires_at <= (${now}::timestamptz AT TIME ZONE 'UTC')
    ORDER BY hold_expires_at ASC
    LIMIT ${Math.max(1, Math.min(limit, 500))}
  `);
}

export type ReleaseHeldOrderOutcome = "RELEASED" | "NOT_FOUND" | "NOT_HELD";

export type ReleaseHeldOrderInput = {
  orderId: string;
  reason: string;
  /**
   * Chạy trong transaction sau khi lock order, trước khi kiểm tra trạng thái và
   * mutate. Ném lỗi (vd ownership) để hủy toàn bộ transaction.
   */
  authorize?: (order: {
    orderId: string;
    userId: string;
    status: string;
  }) => void;
};

export type ReleaseHeldOrderResult = {
  outcome: ReleaseHeldOrderOutcome;
  orderId: string;
  /** Trạng thái kết quả (EXPIRED/CANCELLED) hoặc hiện tại nếu NOT_HELD; "NOT_FOUND" nếu không thấy. */
  status: string;
  userId: string | null;
  concertId: string | null;
  /** Thời điểm release (cancelledAt/expiredAt); null nếu không release. */
  timestamp: Date | null;
  releasedItems: Array<{ ticketTypeId: string; quantity: number }>;
};

export async function releaseHeldOrder(
  input: ReleaseHeldOrderInput,
  db: PrismaClient = prisma,
): Promise<ReleaseHeldOrderResult> {
  return withSerializableRetry(() =>
    db.$transaction(
      async (tx) => {
        const rows = await tx.$queryRaw<ReleaseOrderRow[]>(Prisma.sql`
          SELECT
            o.id AS "orderId",
            o.user_id AS "userId",
            o.concert_id AS "concertId",
            o.status::text AS "orderStatus",
            oi.ticket_type_id AS "ticketTypeId",
            oi.quantity AS "quantity"
          FROM orders o
          JOIN order_items oi ON oi.order_id = o.id
          WHERE o.id = ${input.orderId}::uuid
          FOR UPDATE OF o
        `);

        if (rows.length === 0) {
          return {
            outcome: "NOT_FOUND" as const,
            orderId: input.orderId,
            status: "NOT_FOUND",
            userId: null,
            concertId: null,
            timestamp: null,
            releasedItems: [],
          };
        }

        const { userId, concertId, orderStatus } = rows[0];

        // Ownership / policy check nguyên tử (caller quyết định).
        input.authorize?.({
          orderId: input.orderId,
          userId,
          status: orderStatus,
        });

        if (orderStatus !== OrderStatus.HELD) {
          return {
            outcome: "NOT_HELD" as const,
            orderId: input.orderId,
            status: orderStatus,
            userId,
            concertId,
            timestamp: null,
            releasedItems: [],
          };
        }

        const newStatus =
          input.reason === HOLD_EXPIRED_REASON
            ? OrderStatus.EXPIRED
            : OrderStatus.CANCELLED;
        const now = new Date();

        await tx.order.update({
          where: { id: input.orderId },
          data: {
            status: newStatus,
            ...(newStatus === OrderStatus.EXPIRED
              ? { expiredAt: now }
              : { cancelledAt: now, cancelledReason: input.reason }),
          },
        });

        const releasedItems: Array<{ ticketTypeId: string; quantity: number }> =
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
            WHERE o.id = ${input.orderId}::uuid
              AND utc.user_id = o.user_id
              AND utc.ticket_type_id = ${row.ticketTypeId}::uuid
          `);

          releasedItems.push({
            ticketTypeId: row.ticketTypeId,
            quantity: row.quantity,
          });
        }

        return {
          outcome: "RELEASED" as const,
          orderId: input.orderId,
          status: newStatus,
          userId,
          concertId,
          timestamp: now,
          releasedItems,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );
}

export type ExpireHeldOrderResult = {
  orderId: string;
  status: string;
  releasedItems: Array<{
    ticketTypeId: string;
    quantity: number;
  }>;
};

// Chuyển một order HELD quá hạn sang EXPIRED và trả lại vé/quota. Delegate sang
// nguồn sự thật releaseHeldOrder; giữ nguyên contract cũ cho worker
// (status "NOT_FOUND" nếu không thấy, trạng thái hiện tại nếu không còn HELD).
export async function expireHeldOrder(
  orderId: string,
  db: PrismaClient = prisma,
): Promise<ExpireHeldOrderResult> {
  const result = await releaseHeldOrder(
    { orderId, reason: HOLD_EXPIRED_REASON },
    db,
  );
  return {
    orderId: result.orderId,
    status: result.status,
    releasedItems: result.releasedItems,
  };
}
