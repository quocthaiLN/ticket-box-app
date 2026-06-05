export type ApiResponse<TData> = {
  data: TData;
  meta: {
    request_id: string;
  };
};

export type ApiCollectionResponse<TData> = ApiResponse<TData[]> & {
  pagination: {
    next_cursor: string | null;
    has_more: boolean;
    limit: number;
  };
};

export type ConcertSummary = {
  id: string;
  title: string;
  slug: string;
  artist_name: string;
  starts_at: string;
  ends_at: string;
  status: "PUBLISHED";
};

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/v1";

export async function apiGet<TData>(path: string, init?: RequestInit): Promise<TData> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...init?.headers
    }
  });

  if (!response.ok) {
    throw new Error(`TicketBox API request failed: ${response.status}`);
  }

  return response.json() as Promise<TData>;
}

export async function listConcerts() {
  const response = await apiGet<ApiCollectionResponse<ConcertSummary>>("/concerts");
  return response.data;
}
