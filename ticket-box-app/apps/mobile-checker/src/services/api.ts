export const DEFAULT_API_BASE_URL = 'http://10.0.2.2:3000/v1'; // Default for Android emulator. Use computer IP for real device.

export type PreloadResponse = {
  snapshot_id: string;
  generated_at: string;
  allowed_seat_zones: Array<{ id: string; code: string; name: string }>;
  tickets: Array<{
    ticket_id: string;
    qr_payload_hash: string;
    concert_id: string;
    zone_id: string;
    status_snapshot: string;
  }>;
  guests: Array<{
    guest_id: string;
    concert_id: string;
    zone_id: string;
    full_name: string;
    phone_masked: string;
    status_snapshot: string;
  }>;
};

export type SyncItemInput = {
  client_item_id: string;
  type: 'TICKET' | 'GUEST';
  qr_token: string | null;
  guest_id: string | null;
  phone: string | null;
  concert_id: string;
  gate_id: string;
  local_scanned_at: string;
};

export type SyncResponse = {
  batch_id: string;
  status: 'PENDING' | 'SYNCING' | 'DONE' | 'FAILED';
  accepted_item_count: number;
  conflict_item_count: number;
  results: Array<{
    client_item_id: string;
    status:
      | 'SUCCESS'
      | 'ALREADY_CHECKED_IN'
      | 'WRONG_GATE'
      | 'INVALID_TICKET'
      | 'INVALID_GUEST'
      | 'CONFLICT'
      | 'DUPLICATE_ITEM'
      | 'ERROR';
    message: string;
    ticket_id?: string | null;
    guest_id?: string | null;
  }>;
};

export async function fetchPreload(
  apiBaseUrl: string,
  token: string,
  concertId: string,
  gateId: string,
  deviceId: string
): Promise<PreloadResponse> {
  const baseUrl = apiBaseUrl.trim() || DEFAULT_API_BASE_URL;
  const query = new URLSearchParams({
    concert_id: concertId,
    gate_id: gateId,
    device_id: deviceId,
    include_guests: 'true',
    limit: '20000', // Preload large chunks
  });

  const response = await fetch(`${baseUrl}/check-in/preload?${query}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Tải preload thất bại: ${response.status}`);
  }

  const json = await response.json();
  return json.data;
}

export async function syncOfflineQueue(
  apiBaseUrl: string,
  token: string,
  batchToken: string,
  concertId: string,
  gateId: string,
  deviceId: string,
  items: SyncItemInput[]
): Promise<SyncResponse> {
  const baseUrl = apiBaseUrl.trim() || DEFAULT_API_BASE_URL;

  const response = await fetch(`${baseUrl}/check-in/offline-sync`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      batch_id: batchToken,
      device_id: deviceId,
      concert_id: concertId,
      gate_id: gateId,
      items: items.map((item) => ({
        client_item_id: item.client_item_id,
        type: item.type,
        qr_token: item.qr_token || undefined,
        guest_id: item.guest_id || undefined,
        phone: item.phone || undefined,
        concert_id: item.concert_id,
        gate_id: item.gate_id,
        local_scanned_at: item.local_scanned_at,
      })),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Đồng bộ thất bại: ${response.status}`);
  }

  const json = await response.json();
  return json.data;
}

export async function apiPost<TData>(
  apiBaseUrl: string,
  path: string,
  body?: unknown,
  init?: RequestInit
): Promise<TData> {
  const baseUrl = apiBaseUrl.trim() || DEFAULT_API_BASE_URL;
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...init?.headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    ...init,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Yêu cầu thất bại: ${response.status}`);
  }

  return response.json() as Promise<TData>;
}
