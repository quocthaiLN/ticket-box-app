import { OrderStatus, Prisma, TicketTypeStatus } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";

import { prisma } from "../client.js";
import { withSerializableRetry } from "../serializable-retry.js";

// ---------------------------------------------------------------------------
// hold.ts — Nghiệp vụ "tạo Order + giữ vé" (nguồn sự thật duy nhất).
// createHeldOrder thay cho các bản trùng: inventory.holdInventory,
// orders.createOrderHeld. Caller chỉ là wrapper mỏng, map typed error sang HTTP.
// ---------------------------------------------------------------------------

type UserTicketCounterRow = {
  heldQuantity: number;
  paidQuantity: number;
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

  // Sort để khóa theo thứ tự cố định -> tránh deadlock giữa các transaction.
  const sortedItems = [...input.items].sort((a, b) =>
    a.ticketTypeId.localeCompare(b.ticketTypeId),
  );

  return withSerializableRetry(() =>
    db.$transaction(
      async (tx) => {
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
          FOR UPDATE
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

        // Lock counter của user và enforce giới hạn mỗi người.
        for (const item of sortedItems) {
          await tx.$executeRaw(Prisma.sql`
            INSERT INTO user_ticket_type_counters (user_id, ticket_type_id, held_quantity, paid_quantity)
            VALUES (${input.userId}::uuid, ${item.ticketTypeId}::uuid, 0, 0)
            ON CONFLICT (user_id, ticket_type_id) DO NOTHING
          `);

          const [counter] = await tx.$queryRaw<UserTicketCounterRow[]>(Prisma.sql`
            SELECT held_quantity AS "heldQuantity", paid_quantity AS "paidQuantity"
            FROM user_ticket_type_counters
            WHERE user_id = ${input.userId}::uuid AND ticket_type_id = ${item.ticketTypeId}::uuid
            FOR UPDATE
          `);

          const tt = typeMap.get(item.ticketTypeId)!;
          if (
            counter.heldQuantity + counter.paidQuantity + item.quantity >
            tt.maxPerUser
          ) {
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

        // Tạo order. KHÔNG bắt lỗi trùng idempotency_key (P2002) ở đây — để caller
        // tự xử (orders cần raw P2002 để replay; inventory map sang 409).
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

          await tx.$executeRaw(Prisma.sql`
            UPDATE ticket_types
            SET held_quantity = held_quantity + ${item.quantity}
            WHERE id = ${item.ticketTypeId}::uuid
          `);

          await tx.$executeRaw(Prisma.sql`
            UPDATE user_ticket_type_counters
            SET held_quantity = held_quantity + ${item.quantity}
            WHERE user_id = ${input.userId}::uuid AND ticket_type_id = ${item.ticketTypeId}::uuid
          `);

          // Dedup đã đảm bảo mỗi ticket type chỉ update 1 lần -> snapshot chuẩn.
          const availableQuantityAfter =
            tt.totalQuantity -
            tt.heldQuantity -
            tt.soldQuantity -
            item.quantity;

          items.push({
            orderItemId: orderItem.id,
            ticketTypeId: item.ticketTypeId,
            quantity: item.quantity,
            unitPrice: unitPrice.toString(),
            lineTotal: lineTotal.toString(),
            availableQuantityAfter,
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
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );
}
