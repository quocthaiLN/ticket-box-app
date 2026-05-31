import {
  InventoryEventType,
  Prisma,
  ReservationStatus,
  TicketStatus,
  TicketTypeStatus,
} from "@prisma/client";
import type { InventoryReservation, PrismaClient, Ticket } from "@prisma/client";

import { prisma } from "./client.js";

type InventoryRow = {
  ticketTypeId: string;
  total: number;
  available: number;
  reserved: number;
  sold: number;
  version: number;
  maxPerUser: number;
  saleStartAt: Date;
  saleEndAt: Date;
  status: string;
};

type UserTicketCounterRow = {
  heldQuantity: number;
  paidQuantity: number;
  refundedQuantity: number;
};

type TicketIssueSourceRow = {
  orderItemId: string;
  orderId: string;
  userId: string;
  orderConcertId: string;
  ticketTypeId: string;
  ticketTypeConcertId: string;
  zoneId: string;
  quantity: number;
  issuedCount: number;
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

export async function reserveTicketInventory(
  input: ReserveTicketInventoryInput,
  db: PrismaClient = prisma,
): Promise<InventoryReservation> {
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
      if (input.idempotencyKey) {
        const existing = await tx.inventoryReservation.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
        });

        if (existing) {
          return existing;
        }
      }

      const [inventory] = await tx.$queryRaw<InventoryRow[]>(Prisma.sql`
        SELECT
          i.ticket_type_id AS "ticketTypeId",
          i.total AS "total",
          i.available AS "available",
          i.reserved AS "reserved",
          i.sold AS "sold",
          i.version AS "version",
          tt.max_per_user AS "maxPerUser",
          tt.sale_start_at AS "saleStartAt",
          tt.sale_end_at AS "saleEndAt",
          tt.status::text AS "status"
        FROM ticket_inventories i
        JOIN ticket_types tt ON tt.id = i.ticket_type_id
        WHERE i.ticket_type_id = ${input.ticketTypeId}::uuid
        FOR UPDATE OF i
      `);

      if (!inventory) {
        throw new InventoryReservationError(
          "TICKET_TYPE_NOT_FOUND",
          "Ticket type inventory was not found.",
        );
      }

      const onSaleStatus = String(inventory.status).toLowerCase();
      if (
        onSaleStatus !== "on_sale" &&
        inventory.status !== TicketTypeStatus.ON_SALE
      ) {
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

      if (inventory.available < quantity) {
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
            paid_quantity AS "paidQuantity",
            refunded_quantity AS "refundedQuantity"
          FROM user_ticket_type_counters
          WHERE user_id = ${input.userId}::uuid
            AND ticket_type_id = ${input.ticketTypeId}::uuid
          FOR UPDATE
        `,
      );

      const currentUserQuantity =
        counter.heldQuantity + counter.paidQuantity - counter.refundedQuantity;

      if (currentUserQuantity + quantity > inventory.maxPerUser) {
        throw new InventoryReservationError(
          "MAX_PER_USER_EXCEEDED",
          "Reservation would exceed the per-user ticket limit.",
        );
      }

      await tx.ticketInventory.update({
        where: { ticketTypeId: input.ticketTypeId },
        data: {
          available: { decrement: quantity },
          reserved: { increment: quantity },
          version: { increment: 1 },
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

      const reservation = await tx.inventoryReservation.create({
        data: {
          ticketTypeId: input.ticketTypeId,
          userId: input.userId,
          orderId: input.orderId,
          quantity,
          status: ReservationStatus.HELD,
          idempotencyKey: input.idempotencyKey,
          expiresAt: input.expiresAt,
        },
      });

      await tx.ticketInventoryEvent.create({
        data: {
          ticketTypeId: input.ticketTypeId,
          orderId: input.orderId,
          reservationId: reservation.id,
          eventType: InventoryEventType.HOLD,
          quantity,
          beforeTotal: inventory.total,
          afterTotal: inventory.total,
          beforeAvailable: inventory.available,
          afterAvailable: inventory.available - quantity,
          beforeReserved: inventory.reserved,
          afterReserved: inventory.reserved + quantity,
          beforeSold: inventory.sold,
          afterSold: inventory.sold,
        },
      });

      return reservation;
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
          oi.ticket_type_id AS "ticketTypeId",
          tt.concert_id AS "ticketTypeConcertId",
          tt.zone_id AS "zoneId",
          oi.quantity AS "quantity",
          (
            SELECT COUNT(*)::int
            FROM tickets t
            WHERE t.order_item_id = oi.id
          ) AS "issuedCount"
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
              zoneId: source.zoneId,
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
