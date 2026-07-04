import { apiGet, apiPost, type ApiResponse } from "../lib/api-client";

export type PaymentProvider = "VNPAY" | "MOMO";
export type OrderStatus = "HELD" | "CONFIRMED" | "CANCELLED" | "EXPIRED";
export type PaymentStatus = "PENDING" | "SUCCEEDED" | "FAILED" | "CANCELLED" | "REFUNDED";

export type CreateOrderItemInput = {
  ticket_type_id: string;
  quantity: number;
};

export type CreateOrderInput = {
  concert_id: string;
  items: CreateOrderItemInput[];
};

export type CreateOrderResult = {
  order_id: string;
  status: OrderStatus;
  total_amount: string;
  currency: string;
  hold_expires_at: string | null;
  items: Array<{
    ticket_type_id: string;
    quantity: number;
    unit_price: string;
    line_total: string;
  }>;
};

export type CreatePaymentResult = {
  payment_id: string;
  provider: PaymentProvider;
  status: PaymentStatus;
  checkout_url: string;
  order_id: string;
  hold_expires_at: string;
};

export type OrderDetail = {
  id: string;
  status: OrderStatus;
  total_amount: string;
  currency: string;
  hold_expires_at: string | null;
  confirmed_at: string | null;
  cancelled_at: string | null;
  expired_at: string | null;
  cancelled_reason: string | null;
  created_at: string;
  updated_at: string;
  items: Array<{
    id: string;
    ticket_type_id: string;
    quantity: number;
    unit_price: string;
    line_total: string;
    ticket_type: {
      id: string;
      name: string;
      price: string;
      currency: string;
      seat_zone_code: string;
      seat_zone_name: string;
    };
  }>;
  payment: {
    id: string;
    provider: PaymentProvider;
    status: PaymentStatus;
    checkout_url: string | null;
    amount: string;
    currency: string;
    paid_at: string | null;
    failure_reason: string | null;
    created_at: string;
  } | null;
  tickets: Array<{
    id: string;
    status: string;
    issued_at: string | null;
    ticket_type: {
      id: string;
      name: string;
      seat_zone_code: string;
      seat_zone_name: string;
    };
  }>;
};

export type CancelOrderResult = {
  order_id: string;
  status: OrderStatus;
  cancelled_at: string;
};

export async function createOrder(input: CreateOrderInput, idempotencyKey: string) {
  const response = await apiPost<ApiResponse<CreateOrderResult>>("/orders", input, {
    headers: {
      "Idempotency-Key": idempotencyKey,
    },
  });
  return response.data;
}

export async function getOrder(orderId: string) {
  const response = await apiGet<ApiResponse<OrderDetail>>(`/orders/${orderId}`);
  return response.data;
}

/** Creates a payment attempt for an order already held by POST /orders. */
export async function createPayment(
  orderId: string,
  paymentProvider: PaymentProvider,
  idempotencyKey: string,
) {
  const response = await apiPost<ApiResponse<CreatePaymentResult>>(
    `/orders/${orderId}/payments`,
    { payment_provider: paymentProvider },
    { headers: { "Idempotency-Key": idempotencyKey } },
  );
  return response.data;
}

export async function cancelOrder(orderId: string) {
  const response = await apiPost<ApiResponse<CancelOrderResult>>(`/orders/${orderId}/cancel`);
  return response.data;
}

export function newIdempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `web-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
