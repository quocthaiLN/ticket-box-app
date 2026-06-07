import {
  OrderStatus,
  PaymentStatus,
  Prisma,
  TicketStatus,
  TicketTypeStatus,
} from "@prisma/client";
import type { PrismaClient, Ticket } from "@prisma/client";

import { prisma } from "./client.js";

type InventoryRow = {
  ticketTypeId: string;
  totalQuantity: number;
  heldQuantity: number;
  soldQuantity: number;
  maxPerUser: number;
  saleStartAt: Date;
  saleEndAt: Date;
  status: string;
};

type UserTicketCounterRow = {
  heldQuantity: number;
  paidQuantity: number;
};

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

type ExpiredHeldOrderRow = {
  orderId: string;
  holdExpiresAt: Date;
};

type HeldOrderItemRow = {
  orderId: string;
  orderStatus: string;
  ticketTypeId: string;
  quantity: number;
};

export type InventoryReservationErrorCode =
  | "INVALID_QUANTITY"
  | "INVALID_EXPIRATION"
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

export type ReserveTicketInventoryInput = {
  ticketTypeId: string;
  userId: string;
  quantity: number;
  expiresAt: Date;
  orderId?: string;
  idempotencyKey?: string;
  now?: Date;
};

export type ReserveTicketInventoryResult = {
  ticketTypeId: string;
  userId: string;
  quantity: number;
  availableQuantity: number;
  heldQuantity: number;
  soldQuantity: number;
  expiresAt: Date;
};

export async function reserveTicketInventory(
  input: ReserveTicketInventoryInput,
  db: PrismaClient = prisma,
): Promise<ReserveTicketInventoryResult> {
  const quantity = Number(input.quantity);

  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new InventoryReservationError(
      "INVALID_QUANTITY",
      "Reservation quantity must be a positive integer.",
    );
  }

  const now = input.now ?? new Date();

  if (input.expiresAt <= now) {
    throw new InventoryReservationError(
      "INVALID_EXPIRATION",
      "Reservation expiration must be in the future.",
    );
  }

  return db.$transaction(
    async (tx) => {
      const [inventory] = await tx.$queryRaw<InventoryRow[]>(Prisma.sql`
        SELECT
          id AS "ticketTypeId",
          total_quantity AS "totalQuantity",
          held_quantity AS "heldQuantity",
          sold_quantity AS "soldQuantity",
          max_per_user AS "maxPerUser",
          sale_start_at AS "saleStartAt",
          sale_end_at AS "saleEndAt",
          status::text AS "status"
        FROM ticket_types
        WHERE id = ${input.ticketTypeId}::uuid
        FOR UPDATE
      `);

      if (!inventory) {
        throw new InventoryReservationError(
          "TICKET_TYPE_NOT_FOUND",
          "Ticket type was not found.",
        );
      }

      if (inventory.status !== TicketTypeStatus.ON_SALE) {
        throw new InventoryReservationError(
          "TICKET_TYPE_NOT_ON_SALE",
          "Ticket type is not open for sale.",
        );
      }

      if (now < inventory.saleStartAt || now > inventory.saleEndAt) {
        throw new InventoryReservationError(
          "SALE_WINDOW_CLOSED",
          "Ticket type is outside the sale window.",
        );
      }

      const availableQuantity =
        inventory.totalQuantity - inventory.heldQuantity - inventory.soldQuantity;

      if (availableQuantity < quantity) {
        throw new InventoryReservationError(
          "INSUFFICIENT_INVENTORY",
          "Not enough available tickets to reserve.",
        );
      }

      await tx.userTicketTypeCounter.upsert({
        where: {
          userId_ticketTypeId: {
            userId: input.userId,
            ticketTypeId: input.ticketTypeId,
          },
        },
        create: {
          userId: input.userId,
          ticketTypeId: input.ticketTypeId,
        },
        update: {},
      });

      const [counter] = await tx.$queryRaw<UserTicketCounterRow[]>(
        Prisma.sql`
          SELECT
            held_quantity AS "heldQuantity",
            paid_quantity AS "paidQuantity"
          FROM user_ticket_type_counters
          WHERE user_id = ${input.userId}::uuid
            AND ticket_type_id = ${input.ticketTypeId}::uuid
          FOR UPDATE
        `,
      );

      const currentUserQuantity = counter.heldQuantity + counter.paidQuantity;

      if (currentUserQuantity + quantity > inventory.maxPerUser) {
        throw new InventoryReservationError(
          "MAX_PER_USER_EXCEEDED",
          "Reservation would exceed the per-user ticket limit.",
        );
      }

      await tx.ticketType.update({
        where: { id: input.ticketTypeId },
        data: {
          heldQuantity: { increment: quantity },
        },
      });

      await tx.userTicketTypeCounter.update({
        where: {
          userId_ticketTypeId: {
            userId: input.userId,
            ticketTypeId: input.ticketTypeId,
          },
        },
        data: {
          heldQuantity: { increment: quantity },
        },
      });

      return {
        ticketTypeId: input.ticketTypeId,
        userId: input.userId,
        quantity,
        availableQuantity: availableQuantity - quantity,
        heldQuantity: inventory.heldQuantity + quantity,
        soldQuantity: inventory.soldQuantity,
        expiresAt: input.expiresAt,
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
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

export type ExpireHeldOrderResult = {
  orderId: string;
  status: string;
  releasedItems: Array<{
    ticketTypeId: string;
    quantity: number;
  }>;
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

// Chuyển một order HELD quá hạn sang EXPIRED và trả lại vé/quota trong transaction.
export async function expireHeldOrder(
  orderId: string,
  db: PrismaClient = prisma,
): Promise<ExpireHeldOrderResult> {
  return db.$transaction(
    async (tx) => {
      const rows = await tx.$queryRaw<HeldOrderItemRow[]>(Prisma.sql`
        SELECT
          o.id AS "orderId",
          o.status::text AS "orderStatus",
          oi.ticket_type_id AS "ticketTypeId",
          oi.quantity AS "quantity"
        FROM orders o
        JOIN order_items oi ON oi.order_id = o.id
        WHERE o.id = ${orderId}::uuid
        FOR UPDATE OF o
      `);

      if (rows.length === 0) {
        return {
          orderId,
          status: "NOT_FOUND",
          releasedItems: [],
        };
      }

      if (rows[0].orderStatus !== OrderStatus.HELD) {
        return {
          orderId,
          status: rows[0].orderStatus,
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

      const releasedItems: ExpireHeldOrderResult["releasedItems"] = [];

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
          ticketTypeId: row.ticketTypeId,
          quantity: row.quantity,
        });
      }

      return {
        orderId,
        status: OrderStatus.EXPIRED,
        releasedItems,
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
