import type { Request } from "express";

declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

export interface OrderItem {
  ticket_type_id: string;
  quantity: number;
}

export interface CreateOrderRequest {
  concert_id: string;
  items: OrderItem[];
  payment_provider?: "VNPAY" | "MOMO";
}

export interface CreateOrderResponse {
  order_id: string;
  status: string;
  total_amount: string;
  currency: string;
  hold_expires_at: string | null;
  checkout_url: string;
  payment_id: string;
  items: Array<{
    ticket_type_id: string;
    quantity: number;
    unit_price: string;
    line_total: string;
  }>;
}

export interface OrderTicketTypeView {
  id: string;
  name: string;
  price: string;
  currency: string;
  seat_zone_code: string;
  seat_zone_name: string;
}

export interface OrderItemView {
  id: string;
  ticket_type_id: string;
  quantity: number;
  unit_price: string;
  line_total: string;
  ticket_type: OrderTicketTypeView;
}

export interface PaymentView {
  id: string;
  provider: string;
  status: string;
  checkout_url: string | null;
  amount: string;
  currency: string;
  paid_at: string | null;
  failure_reason: string | null;
  created_at: string;
}

export interface TicketView {
  id: string;
  status: string;
  issued_at: string | null;
  ticket_type: {
    id: string;
    name: string;
    seat_zone_code: string;
    seat_zone_name: string;
  };
}

export interface OrderDetailResponse {
  id: string;
  status: string;
  total_amount: string;
  currency: string;
  hold_expires_at: string | null;
  confirmed_at: string | null;
  cancelled_at: string | null;
  expired_at: string | null;
  cancelled_reason: string | null;
  created_at: string;
  updated_at: string;
  items: OrderItemView[];
  payment: PaymentView | null;
  tickets: TicketView[];
}

export interface CancelOrderResponse {
  order_id: string;
  status: string;
  cancelled_at: string;
}

export interface ExpireOrderResponse {
  order_id: string;
  status: string;
  released_items: Array<{ ticket_type_id: string; quantity: number }>;
}

export interface AdminOrderCursor {
  created_at: string;
  id: string;
}

export interface AdminOrdersQuery {
  cursor?: string;
  limit?: number;
  concert_id?: string;
  status?: string;
  user_id?: string;
  from?: string;
  to?: string;
}

export interface AdminOrderRow {
  id: string;
  userId: string;
  concertId: string;
  status: string;
  totalAmount: string;
  currency: string;
  holdExpiresAt: Date | null;
  confirmedAt: Date | null;
  cancelledAt: Date | null;
  expiredAt: Date | null;
  cancelledReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminOrderListResponse {
  data: AdminOrderRow[];
  next_cursor: string | null;
  has_more: boolean;
}

export interface AppRequest extends Request {}
