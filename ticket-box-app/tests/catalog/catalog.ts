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
const rateLimitedViews = new Counter("catalog_concert_views_rate_limited");
const notFoundViews = new Counter("catalog_concert_views_not_found");
const systemErrors = new Counter("catalog_concert_views_system_errors");
const unexpectedResponses = new Rate("catalog_concert_views_unexpected_response");

export const options = {
  setupTimeout: "2m",
  scenarios: {
    view_concert_detail: {
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
    "http_req_duration{name:GET /v1/concerts/:concert_id}": ["p(95)<1000"],
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
}

export default function (): void {
  const response = http.get(`${BASE_URL}/concerts/${CONCERT_ID}`, {
    tags: {
      name: "GET /v1/concerts/:concert_id",
      concert_id: CONCERT_ID,
    },
    timeout: REQUEST_TIMEOUT,
  });

  const success = response.status === 200;
  const notFound = response.status === 404;
  const rateLimited = response.status === 429;
  const systemError = response.status >= 500;
  const expected = success;

  successfulViews.add(success ? 1 : 0);
  notFoundViews.add(notFound ? 1 : 0);
  rateLimitedViews.add(rateLimited ? 1 : 0);
  systemErrors.add(systemError ? 1 : 0);
  unexpectedResponses.add(!expected);

  check(response, {
    "xem concert public thành công": () => success,
    "response đúng concert đã cấu hình": (res) => {
      if (!success) return true;
      return hasConcertPayload(res);
    },
    "không bị public read rate limit": (res) => res.status !== 429,
  });
}
