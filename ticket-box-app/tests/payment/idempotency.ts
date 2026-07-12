import http, { type RefinedResponse, type ResponseType } from "k6/http";
import { check, fail } from "k6";
import { SharedArray } from "k6/data";

const tokens = new SharedArray("payment_idempotency_tokens", () =>
  JSON.parse(open("../generate-tokens/tokens.json")),
);

const BASE_URL = (__ENV.BASE_URL ?? "http://host.docker.internal:3000/v1").replace(/\/$/, "");
const MOCK_URL = __ENV.MOMO_MOCK_CONTROL_URL ?? "http://host.docker.internal:4101";
const CONCERT_ID = __ENV.PAYMENT_IDEMPOTENCY_CONCERT_ID ?? "00000000-0000-0000-0000-000000000202";
const TICKET_TYPE_ID = __ENV.PAYMENT_IDEMPOTENCY_TICKET_TYPE_ID ?? "00000000-0000-0000-0000-000000000510";

export const options = {
  scenarios: {
    payment_idempotency: { executor: "shared-iterations", vus: 1, iterations: 1 },
  },
  thresholds: { checks: ["rate==1"] },
};

type ApiResponse = {
  data?: { order_id?: string; payment_id?: string; provider?: string; checkout_url?: string };
  code?: string;
};
type SetupData = { runId: string; orders: Array<{ orderId: string; token: string }> };

function json(res: RefinedResponse<ResponseType>): ApiResponse {
  try {
    return res.json() as ApiResponse;
  } catch {
    return {};
  }
}

function params(token: string, key: string) {
  return {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Idempotency-Key": key,
    },
    tags: { name: "POST /v1/orders/:id/payments (idempotency)" },
  };
}

export function setup(): SetupData {
  if (tokens.length < 2) fail("Cần ít nhất 2 access token để test payment idempotency.");
  if (http.get(`${BASE_URL}/health`).status !== 200) fail("API không sẵn sàng.");
  if (http.get(`${MOCK_URL}/health`).status !== 200) fail("MoMo mock không sẵn sàng.");
  if (http.post(`${MOCK_URL}/__control/reset`).status !== 200) fail("Không reset được MoMo mock.");

  const runId = Date.now().toString(36);
  const orders: SetupData["orders"] = [];
  for (let index = 0; index < 2; index += 1) {
    const token = tokens[index].token as string;
    const response = http.post(
      `${BASE_URL}/orders`,
      JSON.stringify({
        concert_id: CONCERT_ID,
        items: [{ ticket_type_id: TICKET_TYPE_ID, quantity: 1 }],
      }),
      params(token, `idem-payment-order-${runId}-${index}`),
    );
    const orderId = json(response).data?.order_id;
    if (response.status !== 201 || !orderId) {
      fail(`Không tạo được HELD order ${index}: HTTP ${response.status} - ${response.body}`);
    }
    orders.push({ orderId, token });
  }
  return { runId, orders };
}

export default function ({ runId, orders }: SetupData): void {
  const firstOrder = orders[0];
  const retryUrl = `${BASE_URL}/orders/${firstOrder.orderId}/payments`;
  const retryKey = `idem-payment-retry-${runId}`;
  const retryParams = params(firstOrder.token, retryKey);

  // 1. Retry tuần tự phải replay cùng payment attempt và checkout URL.
  const first = http.post(retryUrl, JSON.stringify({ payment_provider: "MOMO" }), retryParams);
  const retry = http.post(retryUrl, JSON.stringify({ payment_provider: "MOMO" }), retryParams);
  const firstData = json(first).data;
  check(retry, {
    "payment retry: lần đầu tạo thành công": () => first.status === 201 && Boolean(firstData?.payment_id),
    "payment retry: trả cùng payment_id": (res) => res.status === 201 && json(res).data?.payment_id === firstData?.payment_id,
    "payment retry: trả cùng checkout_url": (res) => json(res).data?.checkout_url === firstData?.checkout_url,
  });

  // 2. Cùng key nhưng đổi provider phải trả conflict trước khi vào payment service.
  const changedProvider = http.post(retryUrl, JSON.stringify({ payment_provider: "VNPAY" }), retryParams);
  check(changedProvider, {
    "payment same key khác payload: HTTP 409": (res) => res.status === 409,
    "payment same key khác payload: đúng error code": (res) => json(res).code === "IDEMPOTENCY_KEY_REUSED",
  });

  // 3. Hai request đồng thời cùng key/payload chỉ tạo một payment attempt.
  const secondOrder = orders[1];
  const concurrentUrl = `${BASE_URL}/orders/${secondOrder.orderId}/payments`;
  const concurrentParams = params(secondOrder.token, `idem-payment-concurrent-${runId}`);
  const payload = JSON.stringify({ payment_provider: "MOMO" });
  const responses = http.batch([
    { method: "POST", url: concurrentUrl, body: payload, params: concurrentParams },
    { method: "POST", url: concurrentUrl, body: payload, params: concurrentParams },
  ]);
  const successfulIds = responses
    .filter((res) => res.status === 201)
    .map((res) => json(res).data?.payment_id)
    .filter((id): id is string => Boolean(id));
  const winnerId = successfulIds[0];
  check(responses[0], {
    "payment concurrent: có request thành công": () => Boolean(winnerId),
    "payment concurrent: mọi response hợp lệ": () => responses.every((res) => {
      const code = json(res).code;
      return res.status === 201 || (res.status === 409 && code === "IDEMPOTENCY_IN_PROGRESS");
    }),
    "payment concurrent: các response thành công cùng payment_id": () => successfulIds.every((id) => id === winnerId),
  });

  const afterConcurrent = http.post(concurrentUrl, payload, concurrentParams);
  check(afterConcurrent, {
    "payment concurrent retry sau hoàn tất trả cùng payment_id": (res) =>
      res.status === 201 && json(res).data?.payment_id === winnerId,
  });
}
