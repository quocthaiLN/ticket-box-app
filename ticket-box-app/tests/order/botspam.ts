import http, { type RefinedResponse, type ResponseType } from "k6/http";
import { check, fail } from "k6";
import exec from "k6/execution";
import { SharedArray } from "k6/data";
import { Counter } from "k6/metrics";

type TokenRecord = { token?: string };
type SetupData = { tokens: string[] };

const allTokens = new SharedArray<TokenRecord>("botspam_order_tokens", () =>
  JSON.parse(open("../generate-tokens/tokens.json")) as TokenRecord[],
);

const BASE_URL = (__ENV.BASE_URL ?? "http://host.docker.internal:3000/v1").replace(/\/$/, "");
const CONCERT_ID = __ENV.BOTSPAM_ORDER_CONCERT_ID ?? "00000000-0000-0000-0000-000000000201";
const TICKET_TYPE_ID = __ENV.BOTSPAM_ORDER_TICKET_TYPE_ID ?? "00000000-0000-0000-0000-000000000504";
const TOKEN_START = Number.parseInt(__ENV.BOTSPAM_TOKEN_START ?? "0", 10);
const RUN_ID = __ENV.RUN_ID ?? Date.now().toString(36);
const TOTAL_ITERATIONS = 500;

const processedOrders = new Counter("orders_processed");
const rateLimitedOrders = new Counter("orders_rate_limited");
const capacityLimitedOrders = new Counter("orders_capacity_limited");
const unexpectedOrders = new Counter("orders_unexpected");

export const options = {
  scenarios: {
    order_ip_botspam: {
      executor: "shared-iterations",
      vus: 250,
      iterations: TOTAL_ITERATIONS,
    },
  },
  thresholds: {
    orders_processed: ["count==50"],
    orders_capacity_limited: ["count==250"],
    orders_rate_limited: ["count==200"],
    orders_unexpected: ["count==0"],
  },
};

function responseCode(response: RefinedResponse<ResponseType>): string | null {
  try {
    return (response.json() as { code?: string }).code ?? null;
  } catch {
    return null;
  }
}

export function setup(): SetupData {
  if (!Number.isInteger(TOKEN_START) || TOKEN_START < 0) {
    fail("BOTSPAM_TOKEN_START phải là số nguyên không âm.");
  }

  const health = http.get(`${BASE_URL}/health`, {
    tags: { name: "GET /v1/health (botspam setup)" },
  });
  if (health.status !== 200) {
    fail(`API health check thất bại: HTTP ${health.status} tại ${BASE_URL}/health`);
  }

  const tokens = allTokens
    .slice(TOKEN_START, TOKEN_START + TOTAL_ITERATIONS)
    .map((record) => record.token)
    .filter((token): token is string => typeof token === "string" && token.length > 0);

  if (tokens.length !== TOTAL_ITERATIONS) {
    fail(
      `Cần ${TOTAL_ITERATIONS} token hợp lệ từ generate-tokens/tokens.json, ` +
        `nhưng chỉ lấy được ${tokens.length}.`,
    );
  }

  return { tokens };
}

export default function ({ tokens }: SetupData): void {
  const iteration = exec.scenario.iterationInTest;
  const token = tokens[iteration];
  if (!token) fail(`Không có token cho iteration ${iteration}.`);

  const response = http.post(
    `${BASE_URL}/orders`,
    JSON.stringify({
      concert_id: CONCERT_ID,
      items: [{ ticket_type_id: TICKET_TYPE_ID, quantity: 1 }],
    }),
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `k6-botspam-order-${RUN_ID}-${iteration}`,
      },
      tags: { name: "POST /v1/orders (botspam)" },
    },
  );

  const code = responseCode(response);
  const processed = response.status === 201 || (response.status === 409 && code === "TICKET_SOLD_OUT");
  const rateLimited = response.status === 429 && code === "RATE_LIMITED";
  const capacityLimited = response.status === 429 && code === "ORDER_CAPACITY_REACHED";
  const unexpected = !processed && !rateLimited && !capacityLimited;

  processedOrders.add(processed ? 1 : 0);
  rateLimitedOrders.add(rateLimited ? 1 : 0);
  capacityLimitedOrders.add(capacityLimited ? 1 : 0);
  unexpectedOrders.add(unexpected ? 1 : 0);

  check(response, {
    "order được xử lý hoặc bị một tầng bảo vệ hợp lệ chặn": () => !unexpected,
    "429 thuộc IP rate limit hoặc admission control": () =>
      response.status !== 429 || rateLimited || capacityLimited,
  });
}
