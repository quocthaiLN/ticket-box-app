import http, { type RefinedResponse, type ResponseType } from "k6/http";
import { check, fail } from "k6";
import exec from "k6/execution";
import { Counter, Rate, Trend } from "k6/metrics";

const BASE_URL = (__ENV.BASE_URL ?? "http://host.docker.internal:3000/v1").replace(
  /\/$/,
  "",
);
const TOTAL_REQUESTS = Number.parseInt(__ENV.TOTAL_REQUESTS ?? "1000", 10);
const USER_COUNT = Number.parseInt(__ENV.USER_COUNT ?? "1000", 10);
const USER_START = Number.parseInt(__ENV.USER_START ?? "1", 10);
const VUS = Number.parseInt(__ENV.VUS ?? "100", 10);
const MAX_CART_ITEMS = Number.parseInt(__ENV.MAX_CART_ITEMS ?? "3", 10);
const RUN_SEED = Number.parseInt(__ENV.RUN_SEED ?? "20260707", 10);
const PASSWORD = __ENV.LOAD_TEST_PASSWORD ?? "Password@123";
const RUN_ID = __ENV.RUN_ID ?? Date.now().toString(36);

type TicketOption = {
  ticketTypeId: string;
  maxPerUser: number;
  weight: number;
};

type ConcertOption = {
  concertId: string;
  weight: number;
  tickets: TicketOption[];
};

// ID và max_per_user lấy từ packages/database/prisma/seed.mjs. Trọng số ưu
// tiên GA/CAT và concert phổ biến, nhưng vẫn tạo traffic cho VIP/SVIP.
// Riêng concert 201 có seed nhỏ để tạo nhánh sold-out có chủ đích.
const concerts: ConcertOption[] = [
  {
    concertId: "00000000-0000-0000-0000-000000000201",
    weight: 20,
    tickets: [
      { ticketTypeId: "00000000-0000-0000-0000-000000000501", maxPerUser: 2, weight: 5 },
      { ticketTypeId: "00000000-0000-0000-0000-000000000502", maxPerUser: 2, weight: 12 },
      { ticketTypeId: "00000000-0000-0000-0000-000000000503", maxPerUser: 4, weight: 28 },
      { ticketTypeId: "00000000-0000-0000-0000-000000000504", maxPerUser: 4, weight: 55 },
    ],
  },
  {
    concertId: "00000000-0000-0000-0000-000000000202",
    weight: 45,
    tickets: [
      { ticketTypeId: "00000000-0000-0000-0000-000000000506", maxPerUser: 2, weight: 5 },
      { ticketTypeId: "00000000-0000-0000-0000-000000000507", maxPerUser: 4, weight: 12 },
      { ticketTypeId: "00000000-0000-0000-0000-000000000508", maxPerUser: 4, weight: 23 },
      { ticketTypeId: "00000000-0000-0000-0000-000000000509", maxPerUser: 6, weight: 25 },
      { ticketTypeId: "00000000-0000-0000-0000-000000000510", maxPerUser: 6, weight: 35 },
    ],
  },
  {
    concertId: "00000000-0000-0000-0000-000000000203",
    weight: 20,
    tickets: [
      { ticketTypeId: "00000000-0000-0000-0000-000000000511", maxPerUser: 2, weight: 5 },
      { ticketTypeId: "00000000-0000-0000-0000-000000000512", maxPerUser: 2, weight: 15 },
      { ticketTypeId: "00000000-0000-0000-0000-000000000513", maxPerUser: 4, weight: 30 },
      { ticketTypeId: "00000000-0000-0000-0000-000000000514", maxPerUser: 4, weight: 50 },
    ],
  },
  {
    concertId: "00000000-0000-0000-0000-000000000204",
    weight: 3,
    tickets: [
      { ticketTypeId: "00000000-0000-0000-0000-000000000516", maxPerUser: 2, weight: 10 },
      { ticketTypeId: "00000000-0000-0000-0000-000000000517", maxPerUser: 2, weight: 30 },
      { ticketTypeId: "00000000-0000-0000-0000-000000000518", maxPerUser: 4, weight: 60 },
    ],
  },
  {
    concertId: "00000000-0000-0000-0000-000000000205",
    weight: 12,
    tickets: [
      { ticketTypeId: "00000000-0000-0000-0000-000000000521", maxPerUser: 2, weight: 8 },
      { ticketTypeId: "00000000-0000-0000-0000-000000000522", maxPerUser: 2, weight: 22 },
      { ticketTypeId: "00000000-0000-0000-0000-000000000523", maxPerUser: 4, weight: 70 },
    ],
  },
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
    return (response.json() as { code?: string }).code ?? null;
  } catch {
    return null;
  }
}

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

  const concert = weightedChoice(
    concerts,
    deterministicRandom(iteration, 1),
  );
  const itemCount = randomItemCount(
    deterministicRandom(iteration, 2),
    concert.tickets.length,
  );
  const selectedTickets = selectTickets(
    concert.tickets,
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
      concert_id: concert.concertId,
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
        concert_id: concert.concertId,
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
