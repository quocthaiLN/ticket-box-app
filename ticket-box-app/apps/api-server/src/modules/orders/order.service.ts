import { cacheGet as get, cacheSet as set } from "@ticketbox/redis";
import { Prisma } from "@ticketbox/database";
import {
  cancelOrderById,
  createOrderHeld,
  expireOrderById,
  findAdminOrders,
  getOrderByIdempotencyKey,
  getOrderWithDetails,
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
} from "./order.type.js";

const IDEMPOTENCY_TTL = 86400; // 24 hours
const idempotencyCacheKey = (userId: string, key: string) =>
  `idempotency:checkout:${userId}:${key}`;

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
  // Trả lại kết quả cũ nếu yêu cầu cùng idempotency key đã được xử lý.
  const cacheKey = idempotencyCacheKey(userId, idempotencyKey);
  const cached = await get(cacheKey);
  if (cached) {
    return cached as CreateOrderResponse;
  }

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
      const existingOrder = await getOrderByIdempotencyKey(idempotencyKey);
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

      await set(cacheKey, response, IDEMPOTENCY_TTL);
      return response;
    }

    throw err;
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

  // Lưu response để các lần gửi lại cùng key không tạo đơn mới.
  await set(cacheKey, response, IDEMPOTENCY_TTL);

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
