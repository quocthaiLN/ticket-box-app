import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { prisma, Prisma, OrderStatus, PaymentStatus, PaymentProvider, TicketStatus } from '@ticketbox/database';
import { cacheDelete } from '@ticketbox/redis';

const inventoryCacheKey = (ticketTypeId: string) => `inventory:${ticketTypeId}`;

export class PaymentError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(code: string, message: string, statusCode = 400) {
    super(message);
    this.name = 'PaymentError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

type OrderForRetryRow = {
  id: string;
  userId: string;
  status: string;
  totalAmount: string;
  currency: string;
  holdExpiresAt: Date | null;
};

type PendingPaymentRow = {
  id: string;
  status: string;
};

type PaymentForWebhookRow = {
  id: string;
  orderId: string;
  status: string;
  amount: string;
};

type OrderItemForTicketRow = {
  itemId: string;
  ticketTypeId: string;
  seatZoneId: string;
  concertId: string;
  userId: string;
  quantity: number;
};

export async function getOrderForRetry(orderId: string, userId: string): Promise<OrderForRetryRow> {
  const [row] = await prisma.$queryRaw<OrderForRetryRow[]>(Prisma.sql`
    SELECT
      id,
      user_id AS "userId",
      status::text AS "status",
      total_amount::text AS "totalAmount",
      currency,
      hold_expires_at AS "holdExpiresAt"
    FROM orders
    WHERE id = ${orderId}::uuid
  `);

  if (!row) {
    throw new PaymentError('ORDER_NOT_FOUND', 'Order not found', 404);
  }
  if (row.userId !== userId) {
    throw new PaymentError('ORDER_ACCESS_DENIED', 'Access denied to this order', 403);
  }
  if (row.status !== OrderStatus.HELD) {
    throw new PaymentError('ORDER_NOT_HELD', `Order is in status ${row.status} and cannot create a new payment`, 422);
  }
  if (row.holdExpiresAt && row.holdExpiresAt < new Date()) {
    throw new PaymentError('ORDER_NOT_HELD', 'Order hold has expired', 422);
  }

  return row;
}

export async function getActivePendingPayment(orderId: string): Promise<PendingPaymentRow | null> {
  const [row] = await prisma.$queryRaw<PendingPaymentRow[]>(Prisma.sql`
    SELECT id, status::text AS "status"
    FROM payments
    WHERE order_id = ${orderId}::uuid AND status = 'PENDING'
    LIMIT 1
  `);
  return row ?? null;
}

export async function createRetryPaymentRecord(
  orderId: string,
  amount: string,
  currency: string,
  provider: 'VNPAY' | 'MOMO',
  checkoutUrl: string,
): Promise<{ id: string; status: string; checkoutUrl: string }> {
  const idempotencyKey = `retry:${orderId}:${provider}:${randomUUID()}`;

  const payment = await prisma.payment.create({
    data: {
      orderId,
      provider: provider === 'VNPAY' ? PaymentProvider.VNPAY : PaymentProvider.MOMO,
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

export async function findPendingPaymentForWebhook(
  orderId: string,
  provider: 'VNPAY' | 'MOMO',
): Promise<PaymentForWebhookRow | null> {
  const providerEnum = provider === 'VNPAY' ? PaymentProvider.VNPAY : PaymentProvider.MOMO;

  const [row] = await prisma.$queryRaw<PaymentForWebhookRow[]>(Prisma.sql`
    SELECT id, order_id AS "orderId", status::text AS "status", amount::text AS "amount"
    FROM payments
    WHERE order_id = ${orderId}::uuid
      AND provider = ${providerEnum}::"PaymentProvider"
    ORDER BY created_at DESC
    LIMIT 1
  `);
  return row ?? null;
}

export async function findPaymentByProviderTxn(
  provider: 'VNPAY' | 'MOMO',
  providerTransactionId: string,
): Promise<{ id: string; status: string; orderId: string } | null> {
  const providerEnum = provider === 'VNPAY' ? PaymentProvider.VNPAY : PaymentProvider.MOMO;

  const [row] = await prisma.$queryRaw<{ id: string; status: string; orderId: string }[]>(Prisma.sql`
    SELECT id, status::text AS "status", order_id AS "orderId"
    FROM payments
    WHERE provider = ${providerEnum}::"PaymentProvider"
      AND provider_transaction_id = ${providerTransactionId}
    LIMIT 1
  `);
  return row ?? null;
}

export async function saveWebhookRawPayload(
  paymentId: string,
  rawPayload: unknown,
  signatureValid: boolean,
  providerTransactionId: string | null,
): Promise<void> {
  await prisma.payment.update({
    where: { id: paymentId },
    data: {
      webhookPayload: rawPayload as Prisma.InputJsonValue,
      webhookReceivedAt: new Date(),
      webhookSignatureValid: signatureValid,
      ...(providerTransactionId ? { providerTransactionId } : {}),
    },
  });
}

export async function confirmOrderPayment(
  paymentId: string,
  orderId: string,
): Promise<void> {
  let affectedTicketTypeIds: string[] = [];

  await prisma.$transaction(async (tx) => {
    // Lock order
    const [orderRow] = await tx.$queryRaw<Array<{ status: string }>>(Prisma.sql`
      SELECT status::text AS "status"
      FROM orders
      WHERE id = ${orderId}::uuid
      FOR UPDATE
    `);

    if (!orderRow) throw new PaymentError('ORDER_NOT_FOUND', 'Order not found', 404);

    // Idempotent: already confirmed
    if (orderRow.status === OrderStatus.CONFIRMED) return;

    if (orderRow.status !== OrderStatus.HELD) {
      throw new PaymentError('ORDER_NOT_HELD', `Order is in status ${orderRow.status}`, 409);
    }

    const now = new Date();

    await tx.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.CONFIRMED, confirmedAt: now },
    });

    await tx.payment.update({
      where: { id: paymentId },
      data: { status: PaymentStatus.SUCCEEDED, paidAt: now },
    });

    // Fetch order items with seat zone info for inventory + ticket issuance
    const items = await tx.$queryRaw<OrderItemForTicketRow[]>(Prisma.sql`
      SELECT
        oi.id AS "itemId",
        oi.ticket_type_id AS "ticketTypeId",
        tt.seat_zone_id AS "seatZoneId",
        o.concert_id AS "concertId",
        o.user_id AS "userId",
        oi.quantity
      FROM order_items oi
      JOIN ticket_types tt ON tt.id = oi.ticket_type_id
      JOIN orders o ON o.id = oi.order_id
      WHERE oi.order_id = ${orderId}::uuid
    `);

    for (const item of items) {
      // Move held → sold
      await tx.$executeRaw(Prisma.sql`
        UPDATE ticket_types
        SET
          held_quantity = GREATEST(0, held_quantity - ${item.quantity}),
          sold_quantity = sold_quantity + ${item.quantity}
        WHERE id = ${item.ticketTypeId}::uuid
      `);

      // Move held → paid in user counters
      await tx.$executeRaw(Prisma.sql`
        UPDATE user_ticket_type_counters utc
        SET
          held_quantity = GREATEST(0, utc.held_quantity - ${item.quantity}),
          paid_quantity = utc.paid_quantity + ${item.quantity}
        FROM orders o
        WHERE o.id = ${orderId}::uuid
          AND utc.user_id = o.user_id
          AND utc.ticket_type_id = ${item.ticketTypeId}::uuid
      `);

      // Issue one ticket per quantity unit
      for (let i = 0; i < item.quantity; i++) {
        const rawToken = `${orderId}:${item.itemId}:${i}:${randomBytes(8).toString('hex')}`;
        const qrTokenHash = createHash('sha256').update(rawToken, 'utf8').digest('hex');

        await tx.ticket.create({
          data: {
            orderId,
            orderItemId: item.itemId,
            userId: item.userId,
            concertId: item.concertId,
            ticketTypeId: item.ticketTypeId,
            seatZoneId: item.seatZoneId,
            qrTokenHash,
            status: TicketStatus.ISSUED,
            issuedAt: now,
          },
        });
      }
    }

    affectedTicketTypeIds = [...new Set(items.map((i) => i.ticketTypeId))];
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  await Promise.allSettled(affectedTicketTypeIds.map((id) => cacheDelete(inventoryCacheKey(id))));
}

export async function failPayment(
  paymentId: string,
  orderId: string,
  failureReason: string,
): Promise<void> {
  let affectedTicketTypeIds: string[] = [];

  await prisma.$transaction(async (tx) => {
    const [paymentRow] = await tx.$queryRaw<Array<{ status: string }>>(Prisma.sql`
      SELECT status::text AS "status" FROM payments WHERE id = ${paymentId}::uuid FOR UPDATE
    `);

    if (!paymentRow || paymentRow.status !== PaymentStatus.PENDING) return;

    await tx.payment.update({
      where: { id: paymentId },
      data: { status: PaymentStatus.FAILED, failureReason },
    });

    // Release hold if order is still HELD
    const items = await tx.$queryRaw<Array<{ ticketTypeId: string; quantity: number }>>(Prisma.sql`
      SELECT
        o.status::text AS "orderStatus",
        oi.ticket_type_id AS "ticketTypeId",
        oi.quantity
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      WHERE o.id = ${orderId}::uuid
        AND o.status = 'HELD'
      FOR UPDATE OF o
    `);

    if (items.length === 0) return;

    await tx.$executeRaw(Prisma.sql`
      UPDATE orders SET status = 'CANCELLED', cancelled_at = NOW(), cancelled_reason = 'PAYMENT_FAILED'
      WHERE id = ${orderId}::uuid AND status = 'HELD'
    `);

    for (const item of items) {
      await tx.$executeRaw(Prisma.sql`
        UPDATE ticket_types
        SET held_quantity = GREATEST(0, held_quantity - ${item.quantity})
        WHERE id = ${item.ticketTypeId}::uuid
      `);
      await tx.$executeRaw(Prisma.sql`
        UPDATE user_ticket_type_counters utc
        SET held_quantity = GREATEST(0, utc.held_quantity - ${item.quantity})
        FROM orders o
        WHERE o.id = ${orderId}::uuid
          AND utc.user_id = o.user_id
          AND utc.ticket_type_id = ${item.ticketTypeId}::uuid
      `);
    }

    affectedTicketTypeIds = [...new Set(items.map((i) => i.ticketTypeId))];
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  await Promise.allSettled(affectedTicketTypeIds.map((id) => cacheDelete(inventoryCacheKey(id))));
}
