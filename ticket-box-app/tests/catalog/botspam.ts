import http, { type RefinedResponse, type ResponseType } from "k6/http";
import { check, fail } from "k6";
import { Counter } from "k6/metrics";

const BASE_URL = (__ENV.BASE_URL ?? "http://host.docker.internal:3000/v1").replace(/\/$/, "");
const CONCERT_ID = __ENV.BOTSPAM_CATALOG_CONCERT_ID ?? "00000000-0000-0000-0000-000000000202";

const successfulRequests = new Counter("catalog_success_requests");
const rateLimitedRequests = new Counter("catalog_rate_limited_requests");
const unexpectedResponses = new Counter("catalog_unexpected_responses");

const endpoints = [
  { path: "", name: "GET /v1/concerts/:concert_id (botspam)" },
  { path: "/metadata", name: "GET /v1/concerts/:concert_id/metadata (botspam)" },
  { path: "/seat-map", name: "GET /v1/concerts/:concert_id/seat-map (botspam)" },
  { path: "/ticket-types", name: "GET /v1/concerts/:concert_id/ticket-types (botspam)" },
  { path: "/inventory", name: "GET /v1/concerts/:concert_id/inventory (botspam)" },
] as const;

export const options = {
  scenarios: {
    catalog_ip_botspam: {
      executor: "shared-iterations",
      vus: 250,
      iterations: 250,
    },
  },
  thresholds: {
    catalog_success_requests: ["count==200"],
    catalog_rate_limited_requests: ["count==1050"],
    catalog_unexpected_responses: ["count==0"],
  },
};

function responseCode(response: RefinedResponse<ResponseType>): string | null {
  try {
    return (response.json() as { code?: string }).code ?? null;
  } catch {
    return null;
  }
}

export function setup(): void {
  const health = http.get(`${BASE_URL}/health`, {
    tags: { name: "GET /v1/health (botspam setup)" },
  });
  if (health.status !== 200) {
    fail(`API health check thất bại: HTTP ${health.status} tại ${BASE_URL}/health`);
  }
}

export default function (): void {
  for (const endpoint of endpoints) {
    const response = http.get(`${BASE_URL}/concerts/${CONCERT_ID}${endpoint.path}`, {
      tags: { name: endpoint.name },
    });
    const success = response.status === 200;
    const rateLimited = response.status === 429 && responseCode(response) === "RATE_LIMITED";
    const unexpected = !success && !rateLimited;

    successfulRequests.add(success ? 1 : 0);
    rateLimitedRequests.add(rateLimited ? 1 : 0);
    unexpectedResponses.add(unexpected ? 1 : 0);

    check(response, {
      "catalog trả 200 hoặc IP rate limit đúng mã": () => !unexpected,
      "429 luôn có code RATE_LIMITED": () => response.status !== 429 || rateLimited,
    });
  }
}
