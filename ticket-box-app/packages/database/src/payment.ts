import { OrderStatus, PaymentStatus, Prisma, TicketStatus } from "@prisma/client";
import type { PrismaClient, Ticket } from "@prisma/client";

import { prisma } from "./client.js";
import { withSerializableRetry } from "./serializable-retry.js";

// ---------------------------------------------------------------------------
// payment.ts — Nghiệp vụ sau thanh toán: phát hành vé cho order đã CONFIRMED.
// (confirmHeldOrder — chuyển held -> sold — sẽ được bổ sung và nối ở đây.)
// ---------------------------------------------------------------------------

type TicketIssueSourceRow = {
  orderItemId: string;
  orderId: string;
  userId: string;
  orderConcertId: string;
  orderStatus: string;
  ticketTypeId: string;
  ticketTypeConcertId: string;
  seatZoneId: string;
  quantity: number;
  issuedCount: number;
  hasSucceededPayment: boolean;
};

export type TicketIssueErrorCode =
  | "INVALID_QR_TOKEN_HASHES"
  | "ORDER_ITEM_NOT_FOUND"
  | "ORDER_ITEM_CONCERT_MISMATCH"
  | "ORDER_NOT_CONFIRMED"
  | "PAYMENT_NOT_SUCCEEDED"
  | "TICKETS_ALREADY_ISSUED"
  | "ISSUED_TICKET_COUNT_MISMATCH";

export class TicketIssueError extends Error {
  constructor(
    public readonly code: TicketIssueErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "TicketIssueError";
  }
}

// ---------------------------------------------------------------------------
// confirmHeldOrder — chuyển một order HELD sang CONFIRMED và dời held -> sold.
// Dùng cho endpoint nội bộ inventory.confirmPayment. KHÔNG tự ném lỗi cho
// not-found / not-held — trả outcome để caller áp chính sách riêng.
// (Luồng payment production tự xử lý confirm + phát hành vé + notification
// trong transaction riêng của nó, không qua hàm này.)
// ---------------------------------------------------------------------------

type ConfirmOrderRow = {
  orderId: string;
  orderStatus: string;
  ticketTypeId: string;
  quantity: number;
};

export type ConfirmHeldOrderOutcome = "CONFIRMED" | "NOT_FOUND" | "NOT_HELD";

export type ConfirmHeldOrderResult = {
  outcome: ConfirmHeldOrderOutcome;
  orderId: string;
  /** CONFIRMED nếu vừa confirm; trạng thái hiện tại nếu NOT_HELD; "NOT_FOUND" nếu không thấy. */
  status: string;
  confirmedAt: Date | null;
  confirmedTicketTypeIds: string[];
};

export async function confirmHeldOrder(
  input: { orderId: string },
  db: PrismaClient = prisma,
): Promise<ConfirmHeldOrderResult> {
  return withSerializableRetry(() =>
    db.$transaction(
      async (tx) => {
        const rows = await tx.$queryRaw<ConfirmOrderRow[]>(Prisma.sql`
          SELECT
            o.id AS "orderId",
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
            confirmedAt: null,
            confirmedTicketTypeIds: [],
          };
        }

        const orderStatus = rows[0].orderStatus;

        if (orderStatus !== OrderStatus.HELD) {
          return {
            outcome: "NOT_HELD" as const,
            orderId: input.orderId,
            status: orderStatus,
            confirmedAt: null,
            confirmedTicketTypeIds: [],
          };
        }

        const now = new Date();

        await tx.order.update({
          where: { id: input.orderId },
          data: { status: OrderStatus.CONFIRMED, confirmedAt: now },
        });

        for (const row of rows) {
          await tx.$executeRaw(Prisma.sql`
            UPDATE ticket_types
            SET
              held_quantity = GREATEST(0, held_quantity - ${row.quantity}),
              sold_quantity = sold_quantity + ${row.quantity}
            WHERE id = ${row.ticketTypeId}::uuid
          `);

          await tx.$executeRaw(Prisma.sql`
            UPDATE user_ticket_type_counters utc
            SET
              held_quantity = GREATEST(0, utc.held_quantity - ${row.quantity}),
              paid_quantity = utc.paid_quantity + ${row.quantity}
            FROM orders o
            WHERE o.id = ${input.orderId}::uuid
              AND utc.user_id = o.user_id
              AND utc.ticket_type_id = ${row.ticketTypeId}::uuid
          `);
        }

        return {
          outcome: "CONFIRMED" as const,
          orderId: input.orderId,
          status: OrderStatus.CONFIRMED,
          confirmedAt: now,
          confirmedTicketTypeIds: [...new Set(rows.map((r) => r.ticketTypeId))],
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );
}

export type IssueTicketsForOrderItemInput = {
  orderItemId: string;
  qrTokenHashes: string[];
  qrPayloads?: Prisma.InputJsonValue[];
  qrSignatures?: Array<string | undefined>;
  issuedAt?: Date;
};

export async function issueTicketsForOrderItem(
  input: IssueTicketsForOrderItemInput,
  db: PrismaClient = prisma,
): Promise<Ticket[]> {
  if (input.qrTokenHashes.length === 0) {
    throw new TicketIssueError(
      "INVALID_QR_TOKEN_HASHES",
      "At least one QR token hash is required.",
    );
  }

  if (new Set(input.qrTokenHashes).size !== input.qrTokenHashes.length) {
    throw new TicketIssueError(
      "INVALID_QR_TOKEN_HASHES",
      "QR token hashes must be unique within the issuance request.",
    );
  }

  return db.$transaction(
    async (tx) => {
      const [source] = await tx.$queryRaw<TicketIssueSourceRow[]>(Prisma.sql`
        SELECT
          oi.id AS "orderItemId",
          oi.order_id AS "orderId",
          o.user_id AS "userId",
          o.concert_id AS "orderConcertId",
          o.status::text AS "orderStatus",
          oi.ticket_type_id AS "ticketTypeId",
          tt.concert_id AS "ticketTypeConcertId",
          tt.seat_zone_id AS "seatZoneId",
          oi.quantity AS "quantity",
          (
            SELECT COUNT(*)::int
            FROM tickets t
            WHERE t.order_item_id = oi.id
          ) AS "issuedCount",
          EXISTS (
            SELECT 1
            FROM payments p
            WHERE p.order_id = o.id
              AND p.status = ${PaymentStatus.SUCCEEDED}::payment_status
          ) AS "hasSucceededPayment"
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        JOIN ticket_types tt ON tt.id = oi.ticket_type_id
        WHERE oi.id = ${input.orderItemId}::uuid
        FOR UPDATE OF oi, o, tt
      `);

      if (!source) {
        throw new TicketIssueError(
          "ORDER_ITEM_NOT_FOUND",
          "Order item was not found.",
        );
      }

      if (source.orderConcertId !== source.ticketTypeConcertId) {
        throw new TicketIssueError(
          "ORDER_ITEM_CONCERT_MISMATCH",
          "Order item ticket type does not belong to the order concert.",
        );
      }

      if (source.orderStatus !== OrderStatus.CONFIRMED) {
        throw new TicketIssueError(
          "ORDER_NOT_CONFIRMED",
          "Tickets can only be issued for confirmed orders.",
        );
      }

      if (!source.hasSucceededPayment) {
        throw new TicketIssueError(
          "PAYMENT_NOT_SUCCEEDED",
          "Tickets can only be issued after a successful payment.",
        );
      }

      const remainingQuantity = source.quantity - source.issuedCount;

      if (remainingQuantity <= 0) {
        throw new TicketIssueError(
          "TICKETS_ALREADY_ISSUED",
          "All tickets for this order item have already been issued.",
        );
      }

      if (input.qrTokenHashes.length !== remainingQuantity) {
        throw new TicketIssueError(
          "ISSUED_TICKET_COUNT_MISMATCH",
          "QR token hash count must match the remaining ticket quantity.",
        );
      }

      const issuedAt = input.issuedAt ?? new Date();
      const tickets: Ticket[] = [];

      for (let index = 0; index < input.qrTokenHashes.length; index += 1) {
        tickets.push(
          await tx.ticket.create({
            data: {
              orderId: source.orderId,
              orderItemId: source.orderItemId,
              userId: source.userId,
              concertId: source.orderConcertId,
              ticketTypeId: source.ticketTypeId,
              seatZoneId: source.seatZoneId,
              qrTokenHash: input.qrTokenHashes[index],
              qrPayload: input.qrPayloads?.[index],
              qrSignature: input.qrSignatures?.[index],
              status: TicketStatus.ISSUED,
              issuedAt,
            },
          }),
        );
      }

      return tickets;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
