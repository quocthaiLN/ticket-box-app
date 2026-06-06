import { get, set } from '@ticketbox/redis';
import { Prisma } from '@ticketbox/database';
import {
  cancelOrderById,
  createOrderHeld,
  createPaymentRecord,
  expireOrderById,
  findAdminOrders,
  getOrderByIdempotencyKey,
  getOrderWithDetails,
  OrderError,
} from './order.repository.js';
import { buildCheckoutUrlWithFallback } from '../payments/payment.service.js';
import type {
  AdminOrderListResponse,
  AdminOrdersQuery,
  CancelOrderResponse,
  CreateOrderRequest,
  CreateOrderResponse,
  ExpireOrderResponse,
  OrderDetailResponse,
} from './order.type.js';

const IDEMPOTENCY_TTL = 86400; // 24 hours
const idempotencyCacheKey = (userId: string, key: string) => `idempotency:checkout:${userId}:${key}`;

function mapOrderWithDetailsToResponse(details: NonNullable<Awaited<ReturnType<typeof getOrderWithDetails>>>): OrderDetailResponse {
  const { order, items, payment, tickets } = details;

  return {
    id: order.id,
    status: order.status,
    total_amount: order.totalAmount,
    currency: order.currency,
    hold_expires_at: order.holdExpiresAt ? order.holdExpiresAt.toISOString() : null,
    confirmed_at: order.confirmedAt ? order.confirmedAt.toISOString() : null,
    cancelled_at: order.cancelledAt ? order.cancelledAt.toISOString() : null,
    expired_at: order.expiredAt ? order.expiredAt.toISOString() : null,
    cancelled_reason: order.cancelledReason,
    created_at: order.createdAt.toISOString(),
    updated_at: order.updatedAt.toISOString(),
    items: items.map((item) => ({
      id: item.id,
      ticket_type_id: item.ticketTypeId,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      line_total: item.lineTotal,
      ticket_type: {
        id: item.ticketTypeId,
        name: item.ticketTypeName,
        price: item.ticketTypePrice,
        currency: item.ticketTypeCurrency,
        seat_zone_code: item.seatZoneCode,
        seat_zone_name: item.seatZoneName,
      },
    })),
    payment: payment
      ? {
          id: payment.id,
          provider: payment.provider,
          status: payment.status,
          checkout_url: payment.checkoutUrl,
          amount: payment.amount,
          currency: payment.currency,
          paid_at: payment.paidAt ? payment.paidAt.toISOString() : null,
          failure_reason: payment.failureReason,
          created_at: payment.createdAt.toISOString(),
        }
      : null,
    tickets: tickets.map((ticket) => ({
      id: ticket.id,
      status: ticket.status,
      issued_at: ticket.issuedAt ? ticket.issuedAt.toISOString() : null,
      ticket_type: {
        id: ticket.ticketTypeId,
        name: ticket.ticketTypeName,
        seat_zone_code: ticket.seatZoneCode,
        seat_zone_name: ticket.seatZoneName,
      },
    })),
  };
}

export async function createOrder(
  userId: string,
  req: CreateOrderRequest,
  idempotencyKey: string,
): Promise<CreateOrderResponse> {
  const cacheKey = idempotencyCacheKey(userId, idempotencyKey);
  const cached = await get(cacheKey);
  if (cached) {
    return cached as CreateOrderResponse;
  }

  let orderResult: Awaited<ReturnType<typeof createOrderHeld>>;

  try {
    orderResult = await createOrderHeld(userId, req, idempotencyKey);
  } catch (err: unknown) {
    // Handle duplicate idempotency key (P2002 Prisma unique constraint violation)
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002' &&
      (err.meta?.target as string[] | undefined)?.includes('idempotency_key')
    ) {
      const existingOrder = await getOrderByIdempotencyKey(idempotencyKey);
      if (!existingOrder) throw err;

      const details = await getOrderWithDetails(existingOrder.id);
      if (!details || !details.payment) throw err;

      const response: CreateOrderResponse = {
        order_id: existingOrder.id,
        status: existingOrder.status,
        total_amount: details.order.totalAmount,
        currency: details.order.currency,
        hold_expires_at: details.order.holdExpiresAt ? details.order.holdExpiresAt.toISOString() : '',
        checkout_url: details.payment.checkoutUrl ?? '',
        payment_id: details.payment.id,
        items: details.items.map((item) => ({
          ticket_type_id: item.ticketTypeId,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          line_total: item.lineTotal,
        })),
      };

      await set(cacheKey, response, IDEMPOTENCY_TTL);
      return response;
    }

    throw err;
  }

  const { order, items } = orderResult;
  const preferredProvider = req.payment_provider ?? 'VNPAY';
  const orderInfo = `Payment for order ${order.id}`;

  const { url: checkoutUrl, provider } = await buildCheckoutUrlWithFallback(
    preferredProvider,
    order.id,
    order.totalAmount,
    order.currency,
    orderInfo,
  );

  const paymentRecord = await createPaymentRecord(
    order.id,
    order.totalAmount,
    order.currency,
    provider,
    checkoutUrl,
    idempotencyKey,
  );

  const response: CreateOrderResponse = {
    order_id: order.id,
    status: order.status,
    total_amount: order.totalAmount,
    currency: order.currency,
    hold_expires_at: order.holdExpiresAt.toISOString(),
    checkout_url: checkoutUrl,
    payment_id: paymentRecord.id,
    items: items.map((item) => ({
      ticket_type_id: item.ticketTypeId,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      line_total: item.lineTotal,
    })),
  };

  await set(cacheKey, response, IDEMPOTENCY_TTL);

  return response;
}

export async function getOrder(orderId: string, userId: string): Promise<OrderDetailResponse> {
  const details = await getOrderWithDetails(orderId);

  if (!details) {
    throw new OrderError('ORDER_NOT_FOUND', 'Order not found', 404);
  }

  if (details.order.userId !== userId) {
    throw new OrderError('ORDER_ACCESS_DENIED', 'Access denied to this order', 403);
  }

  return mapOrderWithDetailsToResponse(details);
}

export async function cancelOrder(orderId: string, userId: string): Promise<CancelOrderResponse> {
  const result = await cancelOrderById(orderId, userId);

  return {
    order_id: result.orderId,
    status: result.status,
    cancelled_at: result.cancelledAt.toISOString(),
  };
}

export async function expireOrder(orderId: string): Promise<ExpireOrderResponse> {
  const result = await expireOrderById(orderId);

  return {
    order_id: result.orderId,
    status: result.status,
    released_items: result.releasedItems,
  };
}

export async function listAdminOrders(query: AdminOrdersQuery): Promise<AdminOrderListResponse> {
  const { rows, nextCursor } = await findAdminOrders(query);

  return {
    data: rows,
    next_cursor: nextCursor,
    has_more: nextCursor !== null,
  };
}
