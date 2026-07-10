import http, { type RefinedResponse, type ResponseType } from "k6/http";
import { check, fail } from "k6";
import exec from "k6/execution";
import { Counter, Rate, Trend } from "k6/metrics";
import { SharedArray } from "k6/data";

// Đọc toàn bộ danh sách JWT token đã được sinh sẵn từ file JSON
const allTokens = new SharedArray("loadtest_tokens", function () {
  return JSON.parse(open("../generate-tokens/tokens.json"));
});

function getEnv(name: string, fallback: string): string {
  const value = __ENV[name];
  return value === undefined ? fallback : value;
}

const BASE_URL = getEnv("BASE_URL", "http://host.docker.internal:3000/v1").replace(
  /\/$/,
  "",
);
const TOTAL_REQUESTS = Number.parseInt(getEnv("TOTAL_REQUESTS", "1000"), 10);
const USER_COUNT = Number.parseInt(getEnv("USER_COUNT", "1000"), 10);
const USER_START = Number.parseInt(getEnv("USER_START", "1"), 10);
const VUS = Number.parseInt(getEnv("VUS", "100"), 10);
const MAX_CART_ITEMS = Number.parseInt(getEnv("MAX_CART_ITEMS", "3"), 10);
const RUN_SEED = Number.parseInt(getEnv("RUN_SEED", "20260707"), 10);
const PASSWORD = getEnv("LOAD_TEST_PASSWORD", "Password@123");
const RUN_ID = getEnv("RUN_ID", Date.now().toString(36));

type TicketOption = {
  ticketTypeId: string;
  maxPerUser: number;
  weight: number;
};

const TARGET_CONCERT_ID = "00000000-0000-0000-0000-000000000201";

// ID và max_per_user lấy từ packages/database/prisma/seed.mjs. Load test order
// chỉ bắn vào một concert đang mở bán để đo đúng tranh chấp giữ vé của concert đó.
const ticketOptions: TicketOption[] = [
  { ticketTypeId: "00000000-0000-0000-0000-000000000501", maxPerUser: 2, weight: 4 },
  { ticketTypeId: "00000000-0000-0000-0000-000000000502", maxPerUser: 2, weight: 10 },
  { ticketTypeId: "00000000-0000-0000-0000-000000000503", maxPerUser: 4, weight: 24 },
  { ticketTypeId: "00000000-0000-0000-0000-000000000504", maxPerUser: 4, weight: 62 },
];

const createdOrders = new Counter("orders_created");
const rejectedOrders = new Counter("orders_rejected");
const soldOutOrders = new Counter("orders_sold_out");
const rateLimitedOrders = new Counter("orders_rate_limited");
const invalidOrders = new Counter("orders_invalid");
const systemErrors = new Counter("orders_system_errors");
const requestedTickets = new Counter("tickets_requested");
const reservedTickets = new Counter("tickets_reserved");
const orderItemCount = new Trend("order_item_count");
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
    orders_rate_limited: ["count==0"],
    orders_invalid: ["count==0"],
    orders_system_errors: ["count==0"],
    orders_unexpected_response: ["rate==0"],
    "http_req_duration{name:POST /v1/orders}": ["p(95)<2000"],
  },
};

type SetupData = { tokens: string[] };

const emailForUser = (index: number): string =>
  `loadtest${String(index).padStart(4, "0")}@ticketbox.test`;

function deterministicRandom(iteration: number, salt: number): number {
  let value = (
    RUN_SEED ^
    Math.imul(iteration + 1, 0x9e3779b1) ^
    Math.imul(salt + 1, 0x85ebca6b)
  ) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d);
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

function weightedChoice<T extends { weight: number }>(
  options: T[],
  random: number,
): T {
  const totalWeight = options.reduce((sum, option) => sum + option.weight, 0);
  let cursor = random * totalWeight;

  for (const option of options) {
    cursor -= option.weight;
    if (cursor <= 0) return option;
  }

  return options[options.length - 1];
}

function randomItemCount(random: number, availableTypes: number): number {
  const requested = random < 0.65 ? 1 : random < 0.9 ? 2 : 3;
  return Math.min(requested, MAX_CART_ITEMS, availableTypes);
}

function randomQuantity(random: number, maxPerUser: number): number {
  const requested =
    random < 0.5
      ? 1
      : random < 0.8
        ? 2
        : random < 0.92
          ? 3
          : random < 0.98
            ? 4
            : maxPerUser;
  return Math.min(requested, maxPerUser);
}

function selectTickets(
  options: TicketOption[],
  count: number,
  iteration: number,
): TicketOption[] {
  const remaining = [...options];
  const selected: TicketOption[] = [];

  for (let index = 0; index < count; index += 1) {
    const chosen = weightedChoice(
      remaining,
      deterministicRandom(iteration, 10 + index),
    );
    selected.push(chosen);
    remaining.splice(remaining.indexOf(chosen), 1);
  }

  return selected;
}

function responseCode(response: RefinedResponse<ResponseType>): string | null {
  try {
    const code = (response.json() as { code?: string }).code;
    return code === undefined ? null : code;
  } catch {
    return null;
  }
}

function accessTokenFrom(response: RefinedResponse<ResponseType>): string | null {
  try {
    const accessToken = (response.json() as { data?: { access_token?: string } }).data
      ?.access_token;
    return accessToken === undefined ? null : accessToken;
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
    USER_START + USER_COUNT - 1 > 100000
  ) {
    fail("USER_START + USER_COUNT phải nằm trong 100.000 user đã seed.");
  }
  if (!Number.isInteger(MAX_CART_ITEMS) || MAX_CART_ITEMS < 1 || MAX_CART_ITEMS > 3) {
    fail("MAX_CART_ITEMS phải nằm trong khoảng 1..3.");
  }
  if (!Number.isInteger(RUN_SEED)) {
    fail("RUN_SEED phải là số nguyên.");
  }

  const health = http.get(`${BASE_URL}/health`, {
    tags: { name: "GET /v1/health (setup)" },
  });
  if (health.status !== 200) {
    fail(`API health check thất bại: HTTP ${health.status} tại ${BASE_URL}/health`);
  }

  const tokens = allTokens
    .slice(USER_START - 1, USER_START - 1 + USER_COUNT)
    .map((t) => t.token);

  if (tokens.length !== USER_COUNT) {
    fail(`Chỉ lấy được ${tokens.length}/${USER_COUNT} access token từ file generate-tokens/tokens.json.`);
  }

  return { tokens };
}

export default function ({ tokens }: SetupData): void {
  const iteration = exec.scenario.iterationInTest;
  const token = tokens[iteration];

  if (!token) {
    fail(`Không có access token cho iteration ${iteration}.`);
  }

  const itemCount = randomItemCount(
    deterministicRandom(iteration, 2),
    ticketOptions.length,
  );
  const selectedTickets = selectTickets(
    ticketOptions,
    itemCount,
    iteration,
  );
  const items = selectedTickets.map((ticket, index) => ({
    ticket_type_id: ticket.ticketTypeId,
    quantity: randomQuantity(
      deterministicRandom(iteration, 100 + index),
      ticket.maxPerUser,
    ),
  }));
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

  orderItemCount.add(items.length);
  requestedTickets.add(totalQuantity);

  const response = http.post(
    `${BASE_URL}/orders`,
    JSON.stringify({
      concert_id: TARGET_CONCERT_ID,
      items,
    }),
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `k6-order-${RUN_ID}-${iteration}`,
      },
      tags: {
        name: "POST /v1/orders",
        concert_id: TARGET_CONCERT_ID,
        cart_size: String(items.length),
      },
    },
  );

  const created = response.status === 201;
  const code = responseCode(response);
  const soldOut = response.status === 409 && code === "TICKET_SOLD_OUT";
  const rateLimited = response.status === 429;
  const systemError = response.status >= 500;
  const invalid = !created && !soldOut && !rateLimited && !systemError;
  const expected = created || soldOut;

  createdOrders.add(created ? 1 : 0);
  rejectedOrders.add(created ? 0 : 1);
  soldOutOrders.add(soldOut ? 1 : 0);
  rateLimitedOrders.add(rateLimited ? 1 : 0);
  invalidOrders.add(invalid ? 1 : 0);
  systemErrors.add(systemError ? 1 : 0);
  reservedTickets.add(created ? totalQuantity : 0);
  unexpectedResponses.add(!expected);

  check(response, {
    "kết quả hợp lệ (201 hoặc sold out)": () => expected,
    "response có order_id": (res) => {
      if (!created) return true;
      try {
        return Boolean(
          (res.json() as { data?: { order_id?: string } }).data?.order_id,
        );
      } catch {
        return false;
      }
    },
    "order thành công trả đủ loại và số lượng vé": (res) => {
      if (!created) return true;
      try {
        const responseItems = (
          res.json() as {
            data?: {
              items?: Array<{ ticket_type_id: string; quantity: number }>;
            };
          }
        ).data?.items;

        if (!responseItems || responseItems.length !== items.length) return false;

        return items.every((requested) =>
          responseItems.some(
            (returned) =>
              returned.ticket_type_id === requested.ticket_type_id &&
              returned.quantity === requested.quantity,
          ),
        );
      } catch {
        return false;
      }
    },
  });
}
