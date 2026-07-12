import http, { type RefinedResponse, type ResponseType } from "k6/http";
import { check, fail } from "k6";
import { Counter, Rate } from "k6/metrics";

function getEnv(name: string, fallback: string): string {
  const value = __ENV[name];
  return value === undefined ? fallback : value;
}

function positiveIntFromEnv(name: string, fallback: string): number {
  const value = Number.parseInt(getEnv(name, fallback), 10);

  if (!Number.isInteger(value) || value <= 0) {
    fail(`${name} phải là số nguyên dương.`);
  }

  return value;
}

const BASE_URL = getEnv("BASE_URL", "http://host.docker.internal:3000/v1").replace(
  /\/$/,
  "",
);
const TOTAL_REQUESTS = positiveIntFromEnv("CATALOG_TOTAL_REQUESTS", "80000");
const VUS = positiveIntFromEnv("CATALOG_VUS", "1000");
const MAX_DURATION = getEnv("CATALOG_MAX_DURATION", "10m");
const REQUEST_TIMEOUT = getEnv("CATALOG_REQUEST_TIMEOUT", "10s");
const CONCERT_ID = getEnv(
  "CATALOG_CONCERT_ID",
  "00000000-0000-0000-0000-000000000202",
);

const successfulViews = new Counter("catalog_concert_views_success");
const successfulMetadataViews = new Counter("catalog_metadata_views_success");
const successfulSeatMapViews = new Counter("catalog_seat_map_views_success");
const successfulTicketTypeViews = new Counter("catalog_ticket_type_views_success");
const successfulInventoryViews = new Counter("catalog_inventory_views_success");
const rateLimitedViews = new Counter("catalog_concert_views_rate_limited");
const notFoundViews = new Counter("catalog_concert_views_not_found");
const systemErrors = new Counter("catalog_concert_views_system_errors");
const unexpectedResponses = new Rate("catalog_concert_views_unexpected_response");

export const options = {
  setupTimeout: "2m",
  scenarios: {
    view_concert_public_catalog: {
      executor: "shared-iterations",
      vus: VUS,
      iterations: TOTAL_REQUESTS,
      maxDuration: MAX_DURATION,
    },
  },
  thresholds: {
    catalog_concert_views_not_found: ["count==0"],
    catalog_concert_views_rate_limited: ["count==0"],
    catalog_concert_views_system_errors: ["count==0"],
    catalog_concert_views_unexpected_response: ["rate==0"],
    "http_req_duration{name:GET /v1/concerts/:concert_id}": ["p(95)<10000"],
    "http_req_duration{name:GET /v1/concerts/:concert_id/metadata}": ["p(95)<10000"],
    "http_req_duration{name:GET /v1/concerts/:concert_id/seat-map}": ["p(95)<10000"],
    "http_req_duration{name:GET /v1/concerts/:concert_id/ticket-types}": ["p(95)<10000"],
    "http_req_duration{name:GET /v1/concerts/:concert_id/inventory}": ["p(95)<10000"],
  },
};

type ConcertDetailResponse = {
  data?: {
    id?: string;
    status?: string;
    title?: string;
    venue?: {
      id?: string;
      name?: string;
    };
  };
};

type ConcertMetadataResponse = {
  data?: {
    concert?: {
      id?: string;
      status?: string;
      title?: string;
    };
    venue?: {
      id?: string;
      name?: string;
    };
    seat_zones?: unknown[];
    ticket_types?: unknown[];
    seat_map?: unknown;
  };
};

type SeatMapResponse = {
  data?: {
    concert_id?: string;
    zones?: unknown[];
  };
};

type TicketTypesResponse = {
  data?: Array<{
    id?: string;
    seat_zone_id?: string;
    name?: string;
    price?: {
      amount?: number;
      currency?: string;
    };
    status?: string;
  }>;
};

type InventoryResponse = {
  data?: {
    concert_id?: string;
    as_of?: string;
    items?: Array<{
      ticket_type_id?: string;
      seat_zone_id?: string;
      available_quantity?: number;
      status?: string;
      display_status?: string;
    }>;
  };
};

function hasConcertPayload(response: RefinedResponse<ResponseType>): boolean {
  try {
    const data = (response.json() as ConcertDetailResponse).data;

    return (
      data?.id === CONCERT_ID &&
      data.status === "PUBLISHED" &&
      typeof data.title === "string" &&
      data.title.length > 0 &&
      typeof data.venue?.name === "string" &&
      data.venue.name.length > 0
    );
  } catch {
    return false;
  }
}

function hasMetadataPayload(response: RefinedResponse<ResponseType>): boolean {
  try {
    const data = (response.json() as ConcertMetadataResponse).data;

    return (
      data?.concert?.id === CONCERT_ID &&
      data.concert.status === "PUBLISHED" &&
      typeof data.concert.title === "string" &&
      data.concert.title.length > 0 &&
      typeof data.venue?.name === "string" &&
      data.venue.name.length > 0 &&
      Array.isArray(data.seat_zones) &&
      Array.isArray(data.ticket_types) &&
      typeof data.seat_map === "object" &&
      data.seat_map !== null
    );
  } catch {
    return false;
  }
}

function hasSeatMapPayload(response: RefinedResponse<ResponseType>): boolean {
  try {
    const data = (response.json() as SeatMapResponse).data;

    return data?.concert_id === CONCERT_ID && Array.isArray(data.zones);
  } catch {
    return false;
  }
}

function hasTicketTypesPayload(response: RefinedResponse<ResponseType>): boolean {
  try {
    const data = (response.json() as TicketTypesResponse).data;

    return (
      Array.isArray(data) &&
      data.length > 0 &&
      data.every((ticketType) =>
        typeof ticketType.id === "string" &&
        typeof ticketType.seat_zone_id === "string" &&
        typeof ticketType.name === "string" &&
        typeof ticketType.price?.amount === "number" &&
        ticketType.price.currency === "VND" &&
        ["ON_SALE", "SOLD_OUT", "CLOSED"].includes(ticketType.status ?? "")
      )
    );
  } catch {
    return false;
  }
}

function hasInventoryPayload(response: RefinedResponse<ResponseType>): boolean {
  try {
    const data = (response.json() as InventoryResponse).data;

    return (
      data?.concert_id === CONCERT_ID &&
      typeof data.as_of === "string" &&
      Array.isArray(data.items) &&
      data.items.length > 0 &&
      data.items.every((item) =>
        typeof item.ticket_type_id === "string" &&
        typeof item.seat_zone_id === "string" &&
        typeof item.available_quantity === "number" &&
        item.available_quantity >= 0 &&
        ["ON_SALE", "SOLD_OUT", "CLOSED"].includes(item.status ?? "") &&
        ["AVAILABLE", "LOW_STOCK", "SOLD_OUT", "CLOSED", "UPDATING"].includes(
          item.display_status ?? "",
        )
      )
    );
  } catch {
    return false;
  }
}

function recordCatalogResponse(response: RefinedResponse<ResponseType>): boolean {
  const success = response.status === 200;
  const notFound = response.status === 404;
  const rateLimited = response.status === 429;
  const systemError = response.status >= 500;

  notFoundViews.add(notFound ? 1 : 0);
  rateLimitedViews.add(rateLimited ? 1 : 0);
  systemErrors.add(systemError ? 1 : 0);
  unexpectedResponses.add(!success);

  return success;
}

function getCatalogEndpoint(
  path: string,
  tagName: string,
): RefinedResponse<ResponseType> {
  return http.get(`${BASE_URL}/concerts/${CONCERT_ID}${path}`, {
    tags: {
      name: tagName,
      concert_id: CONCERT_ID,
    },
    timeout: REQUEST_TIMEOUT,
  });
}

export function setup(): void {
  if (VUS > TOTAL_REQUESTS) {
    fail("CATALOG_VUS không được lớn hơn CATALOG_TOTAL_REQUESTS.");
  }

  const health = http.get(`${BASE_URL}/health`, {
    tags: { name: "GET /v1/health (setup)" },
    timeout: REQUEST_TIMEOUT,
  });
  if (health.status !== 200) {
    fail(`API health check thất bại: HTTP ${health.status} tại ${BASE_URL}/health`);
  }

  const warmup = http.get(`${BASE_URL}/concerts/${CONCERT_ID}`, {
    tags: { name: "GET /v1/concerts/:concert_id (setup)" },
    timeout: REQUEST_TIMEOUT,
  });
  if (warmup.status !== 200 || !hasConcertPayload(warmup)) {
    fail(
      `Concert public không sẵn sàng: HTTP ${warmup.status} tại ` +
      `${BASE_URL}/concerts/${CONCERT_ID}`,
    );
  }

  const warmupChecks: Array<{
    label: string;
    path: string;
    tagName: string;
    isValid: (response: RefinedResponse<ResponseType>) => boolean;
  }> = [
      {
        label: "metadata",
        path: "/metadata",
        tagName: "GET /v1/concerts/:concert_id/metadata",
        isValid: hasMetadataPayload,
      },
      {
        label: "seat-map",
        path: "/seat-map",
        tagName: "GET /v1/concerts/:concert_id/seat-map",
        isValid: hasSeatMapPayload,
      },
      {
        label: "ticket-types",
        path: "/ticket-types",
        tagName: "GET /v1/concerts/:concert_id/ticket-types",
        isValid: hasTicketTypesPayload,
      },
      {
        label: "inventory",
        path: "/inventory",
        tagName: "GET /v1/concerts/:concert_id/inventory",
        isValid: hasInventoryPayload,
      },
    ];

  for (const endpoint of warmupChecks) {
    const response = getCatalogEndpoint(endpoint.path, `${endpoint.tagName} (setup)`);
    if (response.status !== 200 || !endpoint.isValid(response)) {
      fail(
        `Catalog ${endpoint.label} không sẵn sàng: HTTP ${response.status} tại ` +
        `${BASE_URL}/concerts/${CONCERT_ID}${endpoint.path}`,
      );
    }
  }
}

export default function (): void {
  const detailResponse = getCatalogEndpoint("", "GET /v1/concerts/:concert_id");
  const detailSuccess = recordCatalogResponse(detailResponse);
  successfulViews.add(detailSuccess ? 1 : 0);

  check(detailResponse, {
    "xem concert public thành công": () => detailSuccess,
    "response đúng concert đã cấu hình": (res: RefinedResponse<ResponseType>) => {
      if (!detailSuccess) return true;
      return hasConcertPayload(res);
    },
    "không bị public read rate limit": (res: RefinedResponse<ResponseType>) =>
      res.status !== 429,
  });

  const metadataResponse = getCatalogEndpoint(
    "/metadata",
    "GET /v1/concerts/:concert_id/metadata",
  );
  const metadataSuccess = recordCatalogResponse(metadataResponse);
  successfulMetadataViews.add(metadataSuccess ? 1 : 0);

  check(metadataResponse, {
    "xem metadata concert thành công": () => metadataSuccess,
    "metadata đúng concert đã cấu hình": (res: RefinedResponse<ResponseType>) => {
      if (!metadataSuccess) return true;
      return hasMetadataPayload(res);
    },
    "metadata không bị public read rate limit": (res: RefinedResponse<ResponseType>) =>
      res.status !== 429,
  });

  const seatMapResponse = getCatalogEndpoint(
    "/seat-map",
    "GET /v1/concerts/:concert_id/seat-map",
  );
  const seatMapSuccess = recordCatalogResponse(seatMapResponse);
  successfulSeatMapViews.add(seatMapSuccess ? 1 : 0);

  check(seatMapResponse, {
    "xem seat map concert thành công": () => seatMapSuccess,
    "seat map đúng concert đã cấu hình": (res: RefinedResponse<ResponseType>) => {
      if (!seatMapSuccess) return true;
      return hasSeatMapPayload(res);
    },
    "seat map không bị public read rate limit": (res: RefinedResponse<ResponseType>) =>
      res.status !== 429,
  });

  const ticketTypesResponse = getCatalogEndpoint(
    "/ticket-types",
    "GET /v1/concerts/:concert_id/ticket-types",
  );
  const ticketTypesSuccess = recordCatalogResponse(ticketTypesResponse);
  successfulTicketTypeViews.add(ticketTypesSuccess ? 1 : 0);

  check(ticketTypesResponse, {
    "xem ticket types concert thành công": () => ticketTypesSuccess,
    "ticket types có dữ liệu bán vé hợp lệ": (res: RefinedResponse<ResponseType>) => {
      if (!ticketTypesSuccess) return true;
      return hasTicketTypesPayload(res);
    },
    "ticket types không bị public read rate limit": (res: RefinedResponse<ResponseType>) =>
      res.status !== 429,
  });

  const inventoryResponse = getCatalogEndpoint(
    "/inventory",
    "GET /v1/concerts/:concert_id/inventory",
  );
  const inventorySuccess = recordCatalogResponse(inventoryResponse);
  successfulInventoryViews.add(inventorySuccess ? 1 : 0);

  check(inventoryResponse, {
    "xem inventory concert thành công": () => inventorySuccess,
    "inventory đúng concert và số lượng hợp lệ": (res: RefinedResponse<ResponseType>) => {
      if (!inventorySuccess) return true;
      return hasInventoryPayload(res);
    },
    "inventory không bị public read rate limit": (res: RefinedResponse<ResponseType>) =>
      res.status !== 429,
  });
}
