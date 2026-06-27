import {
  apiGet,
  apiPost,
  apiUploadFile,
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
  description?: string;
  artist_name: string;
  artist_bio?: string;
  status: OrganizerConcertStatus;
  starts_at: string;
  ends_at: string;
  planned_publish_at?: string;
  cover_image_url?: string;
  venue: Pick<Venue, "id" | "name" | "city">;
  seat_zones: OrganizerSeatZone[];
  ticket_types: Array<{
    id: string;
    seat_zone_id: string;
    name: string;
    description?: string;
    zone_code: string;
    zone_name: string;
    price: Money;
    total_quantity: number;
    held_quantity: number;
    sold_quantity: number;
    available_quantity: number;
    max_per_user: number;
    sale_start_at: string;
    sale_end_at: string;
    status: string;
  }>;
};

export type OrganizerSeatZone = {
  id: string;
  code: string;
  name: string;
  description?: string;
  capacity: number;
  svg_path?: string;
  sort_order: number;
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

export type CreateOrganizerTicketTypeInput = {
  seat_zone_id: string;
  name: string;
  description?: string;
  price: Money;
  total_quantity: number;
  max_per_user: number;
  sale_start_at: string;
  sale_end_at: string;
};

export type CreateOrganizerSeatZoneInput = {
  code: string;
  name: string;
  description?: string;
  capacity: number;
  svg_path?: string;
  sort_order?: number;
};

export type OrganizerCoverUpload = {
  object_key: string;
  url_path: string;
  url: string;
};

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

export async function uploadOrganizerCoverImage(file: File) {
  const response = await apiUploadFile<ApiResponse<OrganizerCoverUpload>>(
    "/organizer/uploads/cover-image",
    file,
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

export async function createOrganizerSeatZone(
  concertId: string,
  input: CreateOrganizerSeatZoneInput,
) {
  const response = await apiPost<ApiResponse<OrganizerSeatZone>>(
    `/organizer/concerts/${concertId}/seat-zones`,
    input,
  );
  return response.data;
}

export async function createOrganizerTicketType(
  concertId: string,
  input: CreateOrganizerTicketTypeInput,
) {
  const response = await apiPost<ApiResponse<OrganizerConcert["ticket_types"][number]>>(
    `/organizer/concerts/${concertId}/ticket-types`,
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
