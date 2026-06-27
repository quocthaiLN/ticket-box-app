import { getAccessToken } from "./auth-session";

export type ApiResponse<TData> = {
  data: TData;
  meta: {
    request_id: string;
    [key: string]: unknown;
  };
};

export type ApiCollectionResponse<TData> = ApiResponse<TData[]> & {
  pagination: {
    next_cursor: string | null;
    has_more: boolean;
    limit: number;
  };
};

export type Venue = {
  id: string;
  name: string;
  address: string;
  city: string;
  capacity?: number;
  map_url?: string;
};

export type ConcertStatus = "DRAFT" | "PUBLISHED" | "CANCELLED" | "COMPLETED";

export type ConcertSummary = {
  id: string;
  title: string;
  slug: string;
  description?: string;
  artist_name: string;
  starts_at: string;
  ends_at: string;
  status: ConcertStatus;
  cover_image_url?: string;
  venue: Pick<Venue, "id" | "name" | "city">;
  ticket_price_range?: {
    min_amount: number;
    max_amount: number;
    currency: "VND";
  };
};

export type ConcertDetail = ConcertSummary & {
  description?: string;
  artist_bio?: string;
  artist_bio_image_url?: string;
  seat_map_url?: string;
  venue: Venue;
};

export type SeatZone = {
  id: string;
  code: string;
  name: string;
  description?: string;
  capacity: number;
  svg_path?: string;
  sort_order: number;
};

export type TicketType = {
  id: string;
  concert_id?: string;
  seat_zone_id: string;
  zone_code?: string;
  name: string;
  description?: string;
  price: {
    amount: number;
    currency: "VND";
  };
  max_per_user: number;
  sale_start_at: string;
  sale_end_at: string;
  status: "DRAFT" | "ON_SALE" | "SOLD_OUT" | "CLOSED";
};

export type Inventory = {
  concert_id: string;
  as_of: string;
  items: Array<{
    ticket_type_id: string;
    seat_zone_id: string;
    zone_code: string;
    available_quantity: number;
    status: "ON_SALE" | "SOLD_OUT" | "CLOSED";
    display_status:
      | "AVAILABLE"
      | "LOW_STOCK"
      | "SOLD_OUT"
      | "CLOSED"
      | "UPDATING";
  }>;
};

export type ConcertMetadata = {
  concert: ConcertDetail;
  venue: Venue;
  seat_zones: SeatZone[];
  ticket_types: TicketType[];
  seat_map: {
    svg_url?: string;
    fallback_image_url?: string;
  };
  artist_bio?: string;
  artist_bio_image_url?: string;
};

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/v1";

// Sends a GET request to the TicketBox API and parses the JSON response.
export async function apiGet<TData>(
  path: string,
  init?: RequestInit,
): Promise<TData> {
  return apiRequest<TData>(path, { method: "GET", ...init });
}

export async function apiPost<TData>(
  path: string,
  body?: unknown,
  init?: RequestInit,
): Promise<TData> {
  return apiRequest<TData>(path, jsonInit("POST", body, init));
}

export async function apiPatch<TData>(
  path: string,
  body?: unknown,
  init?: RequestInit,
): Promise<TData> {
  return apiRequest<TData>(path, jsonInit("PATCH", body, init));
}

export async function apiDelete<TData>(
  path: string,
  init?: RequestInit,
): Promise<TData> {
  return apiRequest<TData>(path, { method: "DELETE", ...init });
}

export async function apiUploadFile<TData>(
  path: string,
  file: File,
): Promise<TData> {
  return apiRequest<TData>(path, {
    method: "POST",
    body: file,
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      "X-File-Name": encodeURIComponent(file.name),
    },
  });
}

export async function listConcerts(params: Record<string, string> = {}) {
  const response = await apiGet<ApiCollectionResponse<ConcertSummary>>(
    `/concerts${queryString(params)}`,
  );
  return response.data;
}

export async function getConcert(concertId: string) {
  const response = await apiGet<ApiResponse<ConcertDetail>>(
    `/concerts/${concertId}`,
  );
  return response.data;
}

export async function getConcertMetadata(concertId: string) {
  const response = await apiGet<ApiResponse<ConcertMetadata>>(
    `/concerts/${concertId}/metadata`,
  );
  return response.data;
}

export async function listTicketTypes(
  concertId: string,
  includeClosed = false,
) {
  const response = await apiGet<ApiResponse<TicketType[]>>(
    `/concerts/${concertId}/ticket-types${includeClosed ? "?include_closed=true" : ""}`,
  );
  return response.data;
}

export async function getInventory(concertId: string) {
  const response = await apiGet<ApiResponse<Inventory>>(
    `/concerts/${concertId}/inventory`,
  );
  return response.data;
}

export async function listVenues() {
  const response = await apiGet<ApiCollectionResponse<Venue>>(
    "/admin/venues?limit=100",
  );
  return response.data;
}

export async function listAdminConcerts() {
  const response = await apiGet<ApiCollectionResponse<ConcertSummary>>(
    "/admin/concerts?limit=100&sort=-starts_at",
  );
  return response.data;
}

export function createVenue(input: Omit<Venue, "id">) {
  return apiPost<ApiResponse<Venue>>("/admin/venues", input);
}

export function createConcert(input: Record<string, unknown>) {
  return apiPost<ApiResponse<ConcertDetail>>("/admin/concerts", input);
}

export function publishConcert(concertId: string) {
  return apiPost<ApiResponse<ConcertDetail>>(
    `/admin/concerts/${concertId}/publish`,
  );
}

export function cancelConcert(concertId: string) {
  return apiPost<ApiResponse<ConcertDetail>>(
    `/admin/concerts/${concertId}/cancel`,
  );
}

export function createSeatZone(
  concertId: string,
  input: Record<string, unknown>,
) {
  return apiPost<ApiResponse<SeatZone>>(
    `/admin/concerts/${concertId}/seat-zones`,
    input,
  );
}

export function createTicketType(
  concertId: string,
  input: Record<string, unknown>,
) {
  return apiPost<ApiResponse<TicketType>>(
    `/admin/concerts/${concertId}/ticket-types`,
    input,
  );
}

async function apiRequest<TData>(
  path: string,
  init: RequestInit,
): Promise<TData> {
  const token = getAccessToken();
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    credentials: init.credentials ?? "same-origin",
    headers,
  });

  if (!response.ok) {
    throw new Error(await errorMessage(response));
  }

  if (response.status === 204) {
    return undefined as TData;
  }

  return response.json() as Promise<TData>;
}

function jsonInit(
  method: string,
  body?: unknown,
  init?: RequestInit,
): RequestInit {
  return {
    ...init,
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  };
}

function queryString(params: Record<string, string>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value.trim().length > 0) search.set(key, value);
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

async function errorMessage(response: Response) {
  const fallback = `TicketBox API request failed: ${response.status}`;
  const text = await response.text();
  if (!text) return fallback;

  try {
    const problem = JSON.parse(text) as {
      detail?: string;
      title?: string;
      errors?: Array<{ field?: string; message?: string }>;
    };
    const firstFieldError = problem.errors?.find((item) => item.message);
    if (firstFieldError?.message) return firstFieldError.message;
    return problem.detail ?? problem.title ?? fallback;
  } catch {
    return text;
  }
}
