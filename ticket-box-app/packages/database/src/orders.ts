import { OrderStatus, Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";

import { prisma } from "./client.js";
import { withSerializableRetry } from "./serializable-retry.js";

// ---------------------------------------------------------------------------
// orders.ts — Vòng đời order phía sau hold: release / expire.
// releaseHeldOrder là nguồn sự thật duy nhất cho "trả vé của một order HELD",
// thay cho: inventory.releaseInventory, orders.cancelOrderById/expireOrderById,
// và lõi của expireHeldOrder.
// ---------------------------------------------------------------------------

const HOLD_EXPIRED_REASON = "HOLD_EXPIRED";

type ExpiredHeldOrderRow = {
  orderId: string;
  holdExpiresAt: Date;
};

type ReleaseOrderRow = {
  orderId: string;
  userId: string;
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
      AND hold_expires_at <= ${now}
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
            timestamp: null,
            releasedItems: [],
          };
        }

        const { userId, orderStatus } = rows[0];

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
