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

// Gửi request GET tới API TicketBox và parse JSON response.
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

// Gửi request POST JSON tới API TicketBox và ném lỗi khi server trả non-2xx.
export async function apiPost<TData>(path: string, body: unknown, init?: RequestInit): Promise<TData> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: "POST",
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...init?.headers
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`TicketBox API request failed: ${response.status} ${text}`);
  }

  return response.json() as Promise<TData>;
}

// Lấy danh sách concert public cho trang audience.
export async function listConcerts() {
  const response = await apiGet<ApiCollectionResponse<ConcertSummary>>("/concerts");
  return response.data;
}
