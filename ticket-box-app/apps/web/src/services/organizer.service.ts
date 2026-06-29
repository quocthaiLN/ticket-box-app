import {
  apiGet,
  apiPost,
  type ApiCollectionResponse,
  type ApiResponse,
  type Venue,
} from "../lib/api-client";

export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";
export type OrganizerConcertStatus = "DRAFT" | "PUBLISHED" | "CANCELLED" | "COMPLETED";
export type Money = { amount: number; currency: "VND" };

export type OrganizerRequestTicketType = {
  zone_code: string;
  zone_name: string;
  zone_capacity: number;
  name: string;
  price: Money;
  total_quantity: number;
  max_per_user: number;
  sale_start_at: string;
  sale_end_at: string;
};

export type OrganizerRequestSummary = {
  id: string;
  title: string;
  artist_name: string;
  venue_id: string;
  starts_at: string;
  ends_at: string;
  planned_publish_at?: string;
  gate_count: number;
  checker_count: number;
  status: ApprovalStatus;
  concert_id?: string | null;
  created_at: string;
};

export type OrganizerRequestDetail = OrganizerRequestSummary & {
  description?: string;
  press_kit_url?: string;
  ticket_types: OrganizerRequestTicketType[] | unknown;
  reviewed_by?: string | null;
  reviewed_at?: string;
  review_note?: string;
  updated_at: string;
};

export type OrganizerConcert = {
  id: string;
  title: string;
  slug: string;
  artist_name: string;
  status: OrganizerConcertStatus;
  starts_at: string;
  ends_at: string;
  planned_publish_at?: string;
  cover_image_url?: string;
  venue: Pick<Venue, "id" | "name" | "city">;
};

export type OrganizerAnalytics = {
  concert_id: string;
  revenue: Money;
  tickets_sold: number;
  tickets_total: number;
  checked_in: number;
  check_in_rate: number;
};

export type OrganizerOrder = {
  id: string;
  concert_id: string;
  concert_title: string;
  status: string;
  total_amount: Money;
  created_at: string;
  confirmed_at?: string;
};

export type OrganizerCheckerAccount = {
  id: string;
  concert_id: string;
  concert_title: string;
  user_id: string;
  email: string;
  full_name: string;
  status: string;
  created_at: string;
};

export type CreateOrganizerRequestInput = {
  venue_id: string;
  title: string;
  artist_name: string;
  description?: string;
  starts_at: string;
  ends_at: string;
  planned_publish_at?: string;
  gate_count: number;
  checker_count: number;
  press_kit_url?: string;
  ticket_types: OrganizerRequestTicketType[];
};

export type UpdateOrganizerConcertInput = Partial<{
  venue_id: string;
  title: string;
  description: string;
  artist_name: string;
  artist_bio: string;
  starts_at: string;
  ends_at: string;
  planned_publish_at: string;
  cover_image_url: string;
  seat_map_url: string;
}>;

export async function listOrganizerVenues() {
  const response = await apiGet<ApiCollectionResponse<Venue>>("/organizer/venues?limit=100");
  return response.data;
}

export async function listOrganizerRequests(status?: ApprovalStatus | "all") {
  const query = status && status !== "all" ? `?status=${status}&limit=100` : "?limit=100";
  const response = await apiGet<ApiCollectionResponse<OrganizerRequestSummary>>(
    `/organizer/requests${query}`,
  );
  return response.data;
}

export async function getOrganizerRequest(requestId: string) {
  const response = await apiGet<ApiResponse<OrganizerRequestDetail>>(
    `/organizer/requests/${requestId}`,
  );
  return response.data;
}

export async function createOrganizerRequest(input: CreateOrganizerRequestInput) {
  const response = await apiPost<ApiResponse<OrganizerRequestSummary>>(
    "/organizer/requests",
    input,
  );
  return response.data;
}

export async function listOrganizerConcerts(params: { q?: string; status?: string } = {}) {
  const search = new URLSearchParams({ limit: "100" });
  if (params.q) search.set("q", params.q);
  if (params.status && params.status !== "all") search.set("status", params.status);
  const response = await apiGet<ApiCollectionResponse<OrganizerConcert>>(
    `/organizer/concerts?${search}`,
  );
  return response.data;
}

export async function updateOrganizerConcert(
  concertId: string,
  input: UpdateOrganizerConcertInput,
) {
  const response = await apiPost<ApiResponse<{ id: string; status: string; updated_at: string }>>(
    `/organizer/concerts/${concertId}`,
    input,
  );
  return response.data;
}

export async function createOrganizerDeletionRequest(concertId: string, reason: string) {
  const response = await apiPost<ApiResponse<{ id: string; concert_id: string; status: string }>>(
    `/organizer/concerts/${concertId}/deletion-requests`,
    { reason },
  );
  return response.data;
}

export async function getOrganizerAnalytics(concertId: string) {
  const response = await apiGet<ApiResponse<OrganizerAnalytics>>(
    `/organizer/concerts/${concertId}/analytics`,
  );
  return response.data;
}

export async function listOrganizerOrders() {
  const response = await apiGet<ApiCollectionResponse<OrganizerOrder>>(
    "/organizer/orders?limit=100",
  );
  return response.data;
}

export async function listOrganizerCheckerAccounts() {
  const response = await apiGet<ApiCollectionResponse<OrganizerCheckerAccount>>(
    "/organizer/checker-accounts?limit=100",
  );
  return response.data;
}

export function normalizeTicketTypes(value: OrganizerRequestDetail["ticket_types"]) {
  return Array.isArray(value) ? (value as OrganizerRequestTicketType[]) : [];
}
