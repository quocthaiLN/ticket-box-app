import { apiGet, type ApiResponse } from "../lib/api-client";

export type TicketStatus = "ISSUED" | "CHECKED_IN" | "CANCELLED" | "REFUNDED";

export type TicketListItem = {
  id: string;
  concert_id: string;
  concert_title: string;
  ticket_type_id: string;
  ticket_type_name: string;
  seat_zone_id: string;
  zone_code: string;
  status: TicketStatus;
  issued_at: string;
};

export type TicketDetail = {
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
  status: TicketStatus;
  issued_at: string;
  checked_in_at: string | null;
};

export type TicketQr = {
  ticket_id: string;
  payload: {
    ticket_id: string;
    concert_id: string;
    ticket_type_id: string;
    seat_zone_id: string;
    issued_at: string;
    qr_token: string;
  };
  qr_signature: string;
  expires_at: string | null;
};

type TicketListResponse = {
  data: TicketListItem[];
  pagination: {
    next_cursor: string | null;
    has_more: boolean;
    limit: number;
  };
  meta: {
    request_id: string;
  };
};

export async function listMyTickets(input: { status?: TicketStatus | "all"; limit?: number } = {}) {
  const params = new URLSearchParams();
  params.set("limit", String(input.limit ?? 100));
  if (input.status && input.status !== "all") params.set("status", input.status);

  const response = await apiGet<TicketListResponse>(`/me/tickets?${params}`);
  return response.data;
}

export async function getMyTicket(ticketId: string) {
  const response = await apiGet<ApiResponse<TicketDetail>>(`/me/tickets/${ticketId}`);
  return response.data;
}

export async function getMyTicketQr(ticketId: string) {
  const response = await apiGet<ApiResponse<TicketQr>>(`/me/tickets/${ticketId}/qr`);
  return response.data;
}
