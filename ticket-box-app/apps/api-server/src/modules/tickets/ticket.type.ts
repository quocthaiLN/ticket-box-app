import type { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

export interface AppRequest extends Request {}

export interface TicketListQuery {
  concert_id?: string;
  status?: 'ISSUED' | 'CHECKED_IN' | 'CANCELLED' | 'REFUNDED';
  limit?: number;
  cursor?: string;
}

export interface TicketListItem {
  id: string;
  concert_id: string;
  concert_title: string;
  ticket_type_id: string;
  ticket_type_name: string;
  seat_zone_id: string;
  zone_code: string;
  status: string;
  issued_at: string;
}

export interface TicketListResponse {
  data: TicketListItem[];
  pagination: {
    next_cursor: string | null;
    has_more: boolean;
    limit: number;
  };
}

export interface TicketDetail {
  id: string;
  order_id: string;
  concert: {
    id: string;
    title: string;
    starts_at: string;
  };
  ticket_type: {
    id: string;
    name: string;
  };
  seat_zone: {
    id: string;
    code: string;
    name: string;
  };
  status: string;
  issued_at: string;
  checked_in_at: string | null;
}

export interface QrPayload {
  ticket_id: string;
  concert_id: string;
  ticket_type_id: string;
  seat_zone_id: string;
  issued_at: string;
  qr_token: string;
}

export interface TicketQrResponse {
  ticket_id: string;
  payload: QrPayload;
  qr_signature: string;
  expires_at: string | null;
}

export interface IssuedTicketItem {
  id: string;
  ticket_type_id: string;
  seat_zone_id: string;
  status: string;
}

export interface IssueTicketsResponse {
  order_id: string;
  tickets: IssuedTicketItem[];
}

export interface VoidTicketResponse {
  ticket_id: string;
  status: string;
  voided_at: string;
}
