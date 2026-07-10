import {
  acquireSemaphore,
  releaseSemaphore,
  type SemaphoreLease,
} from "@ticketbox/redis";
import { env } from "@ticketbox/config";
import { Prisma } from "@ticketbox/database";
import {
  cancelOrderById,
  createOrderHeld,
  expireOrderById,
  findAdminOrders,
  getOrderByIdempotencyKey,
  getOrderWithDetails,
  getUserTicketQuotas,
} from "./repository/order.repository.js";
import { ApiError } from "../../shared/http/problem-details.js";
import type {
  AdminOrderListResponse,
  AdminOrdersQuery,
  CancelOrderResponse,
  CreateOrderRequest,
  CreateOrderResponse,
  ExpireOrderResponse,
  OrderDetailResponse,
  TicketQuotaResponse,
} from "./order.type.js";

const orderAdmissionKey = (concertId: string) =>
  `semaphore:orders:concert:${concertId}`;

async function acquireOrderAdmission(concertId: string): Promise<SemaphoreLease | null> {
  if (!env.order.admissionEnabled) return null;

  const result = await acquireSemaphore(
    orderAdmissionKey(concertId),
    env.order.admissionConcurrencyPerConcert,
    env.order.admissionLeaseMs,
  );

  if (result.status === "FULL") {
    throw new ApiError(
      {
        title: "Order capacity reached",
        status: 429,
        code: "ORDER_CAPACITY_REACHED",
        detail: `Too many orders are being processed for this concert. Retry after ${env.order.admissionRetryAfterSeconds} second(s).`,
      },
      { "Retry-After": String(env.order.admissionRetryAfterSeconds) },
    );
  }

  if (result.status === "UNAVAILABLE") {
    throw new ApiError({
      title: "Order service unavailable",
      status: 503,
      code: "ORDER_ADMISSION_UNAVAILABLE",
      detail: "Order admission control is temporarily unavailable.",
    });
  }

  return result.lease;
}

// mapOrderWithDetailsToResponse dùng để chuyển dữ liệu đơn hàng lấy từ repository sang đúng cấu trúc API OrderDetailResponse.
function mapOrderWithDetailsToResponse(
  details: NonNullable<Awaited<ReturnType<typeof getOrderWithDetails>>>,
): OrderDetailResponse {
  const { order, items, payment, tickets } = details;

  return {
    id: order.id,
    status: order.status,
    total_amount: order.totalAmount,
    currency: order.currency,
    hold_expires_at: order.holdExpiresAt
      ? order.holdExpiresAt.toISOString()
      : null,
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
  const t0 = Date.now();
  const admissionLease = await acquireOrderAdmission(req.concert_id);

  const t1 = Date.now();

  // Khai báo kết quả của createOrder
  let orderResult: Awaited<ReturnType<typeof createOrderHeld>>;

  try {
    // Tạo đơn hàng ở trạng thái giữ chỗ và trừ tồn kho tương ứng.
    orderResult = await createOrderHeld(userId, req, idempotencyKey);
  } catch (err: unknown) {
    // Xử lý trường hợp hai yêu cầu đồng thời dùng cùng idempotency key ở mức redis - siêu hiếm - lấy order đã được tạo trước ở mức database
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002" &&
      (err.meta?.target as string[] | undefined)?.includes("idempotency_key")
    ) {
      const existingOrder = await getOrderByIdempotencyKey(userId, idempotencyKey);
      if (!existingOrder) throw err;

      const details = await getOrderWithDetails(existingOrder.id);
      if (!details) throw err;

      // Tái tạo response của đơn hàng đã tồn tại để trả về nhất quán.
      const response: CreateOrderResponse = {
        order_id: existingOrder.id,
        status: existingOrder.status,
        total_amount: details.order.totalAmount,
        currency: details.order.currency,
        hold_expires_at: details.order.holdExpiresAt?.toISOString() ?? null,
        items: details.items.map((item) => ({
          ticket_type_id: item.ticketTypeId,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          line_total: item.lineTotal,
        })),
      };

      return response;
    }

    throw err;
  } finally {
    if (admissionLease) {
      await releaseSemaphore(admissionLease);
    }
  }

  const { order, items } = orderResult;

  // Chỉ giữ vé ở bước này; thanh toán tách sang POST /orders/:order_id/payments.
  const response: CreateOrderResponse = {
    order_id: order.id,
    status: order.status,
    total_amount: order.totalAmount,
    currency: order.currency,
    hold_expires_at: order.holdExpiresAt.toISOString(),
    items: items.map((item) => ({
      ticket_type_id: item.ticketTypeId,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      line_total: item.lineTotal,
    })),
  };

  const t2 = Date.now();

  const t3 = Date.now();

  console.log(JSON.stringify({
    event: "createOrder",
    admission_ms: t1 - t0,
    tx_ms: t2 - t1,
    response_map_ms: t3 - t2,
    total_ms: t3 - t0,
  }));

  return response;
}

export async function getOrder(
  orderId: string,
  userId: string,
): Promise<OrderDetailResponse> {
  const details = await getOrderWithDetails(orderId);

  if (!details) {
    throw new ApiError({
      title: "ORDER_NOT_FOUND",
      status: 404,
      code: "ORDER_NOT_FOUND",
      detail: "Order not found",
    });
  }

  if (details.order.userId !== userId) {
    throw new ApiError({
      title: "ORDER_ACCESS_DENIED",
      status: 403,
      code: "ORDER_ACCESS_DENIED",
      detail: "Access denied to this order",
    });
  }

  return mapOrderWithDetailsToResponse(details);
}

export async function getTicketQuota(
  userId: string,
  concertId: string,
): Promise<TicketQuotaResponse> {
  const items = await getUserTicketQuotas(userId, concertId);

  return {
    concert_id: concertId,
    items: items.map((item) => ({
      ticket_type_id: item.ticketTypeId,
      max_per_user: item.maxPerUser,
      held_quantity: item.heldQuantity,
      paid_quantity: item.paidQuantity,
      remaining_quantity: item.remainingQuantity,
    })),
  };
}

export async function cancelOrder(
  orderId: string,
  userId: string,
): Promise<CancelOrderResponse> {
  const result = await cancelOrderById(orderId, userId);

  return {
    order_id: result.orderId,
    status: result.status,
    cancelled_at: result.cancelledAt.toISOString(),
  };
}

export async function expireOrder(
  orderId: string,
): Promise<ExpireOrderResponse> {
  const result = await expireOrderById(orderId);

  return {
    order_id: result.orderId,
    status: result.status,
    released_items: result.releasedItems,
  };
}

export async function listAdminOrders(
  query: AdminOrdersQuery,
): Promise<AdminOrderListResponse> {
  const { rows, nextCursor } = await findAdminOrders(query);

  return {
    data: rows,
    next_cursor: nextCursor,
    has_more: nextCursor !== null,
  };
}
