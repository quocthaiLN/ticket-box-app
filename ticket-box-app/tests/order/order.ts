import http, { type RefinedResponse, type ResponseType } from "k6/http";
import { check, fail } from "k6";
import exec from "k6/execution";
import { Counter, Rate } from "k6/metrics";

const BASE_URL = (__ENV.BASE_URL ?? "http://host.docker.internal:3000/v1").replace(
  /\/$/,
  "",
);
const TOTAL_REQUESTS = Number.parseInt(__ENV.TOTAL_REQUESTS ?? "1000", 10);
const USER_COUNT = Number.parseInt(__ENV.USER_COUNT ?? "1000", 10);
const USER_START = Number.parseInt(__ENV.USER_START ?? "1", 10);
const VUS = Number.parseInt(__ENV.VUS ?? "100", 10);
const QUANTITY = Number.parseInt(__ENV.QUANTITY ?? "1", 10);
const PASSWORD = __ENV.LOAD_TEST_PASSWORD ?? "Password@123";
const RUN_ID = __ENV.RUN_ID ?? Date.now().toString(36);

// Concert 2 / GA từ packages/database/prisma/seed.mjs: còn đủ tồn kho cho
// bài test 1.000 order, mỗi user đặt một lần mà không vướng max_per_user.
const CONCERT_ID =
  __ENV.CONCERT_ID ?? "00000000-0000-0000-0000-000000000202";
const TICKET_TYPE_ID =
  __ENV.TICKET_TYPE_ID ?? "00000000-0000-0000-0000-000000000510";

const createdOrders = new Counter("orders_created");
const rejectedOrders = new Counter("orders_rejected");
const unexpectedResponses = new Rate("orders_unexpected_response");

export const options = {
  setupTimeout: "10m",
  scenarios: {
    create_orders: {
      executor: "shared-iterations",
      vus: VUS,
      iterations: TOTAL_REQUESTS,
      maxDuration: "10m",
    },
  },
  thresholds: {
    orders_created: [`count==${TOTAL_REQUESTS}`],
    orders_rejected: ["count==0"],
    orders_unexpected_response: ["rate==0"],
    "http_req_duration{name:POST /v1/orders}": ["p(95)<2000"],
  },
};

type SetupData = { tokens: string[] };

const emailForUser = (index: number): string =>
  `loadtest${String(index).padStart(4, "0")}@ticketbox.test`;

function accessTokenFrom(response: RefinedResponse<ResponseType>): string | null {
  try {
    return (
      response.json() as { data?: { access_token?: string } }
    ).data?.access_token ?? null;
  } catch {
    return null;
  }
}

export function setup(): SetupData {
  if (!Number.isInteger(TOTAL_REQUESTS) || TOTAL_REQUESTS <= 0) {
    fail("TOTAL_REQUESTS phải là số nguyên dương.");
  }
  if (TOTAL_REQUESTS > USER_COUNT) {
    fail("TOTAL_REQUESTS không được lớn hơn USER_COUNT vì mỗi request dùng một user.");
  }
  if (
    !Number.isInteger(USER_START) ||
    USER_START <= 0 ||
    USER_START + USER_COUNT - 1 > 1000
  ) {
    fail("USER_START + USER_COUNT phải nằm trong 1.000 user đã seed.");
  }
  if (!Number.isInteger(QUANTITY) || QUANTITY <= 0) {
    fail("QUANTITY phải là số nguyên dương.");
  }

  const health = http.get(`${BASE_URL}/health`, {
    tags: { name: "GET /v1/health (setup)" },
  });
  if (health.status !== 200) {
    fail(`API health check thất bại: HTTP ${health.status} tại ${BASE_URL}/health`);
  }

  const tokens: string[] = [];
  const batchSize = 20;

  // Đăng nhập 1.000 user seed theo từng batch để tạo 1.000 access token thật.
  const lastUser = USER_START + USER_COUNT - 1;
  for (let start = USER_START; start <= lastUser; start += batchSize) {
    const end = Math.min(start + batchSize - 1, lastUser);
    const requests = [];

    for (let index = start; index <= end; index += 1) {
      requests.push({
        method: "POST",
        url: `${BASE_URL}/auth/login`,
        body: JSON.stringify({ email: emailForUser(index), password: PASSWORD }),
        params: {
          headers: { "Content-Type": "application/json" },
          tags: { name: "POST /v1/auth/login (setup)" },
        },
      });
    }

    const responses = http.batch(requests);
    responses.forEach((response, offset) => {
      const token = accessTokenFrom(response);
      if (response.status !== 200 || !token) {
        fail(
          `Đăng nhập thất bại cho ${emailForUser(start + offset)}: HTTP ${response.status}`,
        );
      }
      tokens.push(token);
    });
  }

  if (tokens.length !== USER_COUNT) {
    fail(`Chỉ tạo được ${tokens.length}/${USER_COUNT} access token.`);
  }

  return { tokens };
}

export default function ({ tokens }: SetupData): void {
  const iteration = exec.scenario.iterationInTest;
  const token = tokens[iteration];

  if (!token) {
    fail(`Không có access token cho iteration ${iteration}.`);
  }

  const response = http.post(
    `${BASE_URL}/orders`,
    JSON.stringify({
      concert_id: CONCERT_ID,
      items: [{ ticket_type_id: TICKET_TYPE_ID, quantity: QUANTITY }],
    }),
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `k6-order-${RUN_ID}-${iteration}`,
      },
      tags: { name: "POST /v1/orders" },
    },
  );

  const created = response.status === 201;
  createdOrders.add(created ? 1 : 0);
  rejectedOrders.add(created ? 0 : 1);
  unexpectedResponses.add(!created);

  check(response, {
    "tạo order thành công (201)": () => created,
    "response có order_id": (res) => {
      if (!created) return false;
      try {
        return Boolean(
          (res.json() as { data?: { order_id?: string } }).data?.order_id,
        );
      } catch {
        return false;
      }
    },
  });
}
