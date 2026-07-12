import http, { type RefinedResponse, type ResponseType } from "k6/http";
import { check, fail } from "k6";
import { SharedArray } from "k6/data";

const tokens = new SharedArray("order_idempotency_tokens", () =>
  JSON.parse(open("../generate-tokens/tokens.json")),
);

const BASE_URL = (__ENV.BASE_URL ?? "http://host.docker.internal:3000/v1").replace(/\/$/, "");
const CONCERT_ID = __ENV.ORDER_IDEMPOTENCY_CONCERT_ID ?? "00000000-0000-0000-0000-000000000201";
const TICKET_TYPE_ID = __ENV.ORDER_IDEMPOTENCY_TICKET_TYPE_ID ?? "00000000-0000-0000-0000-000000000504";

export const options = {
  scenarios: {
    order_idempotency: { executor: "shared-iterations", vus: 1, iterations: 1 },
  },
  thresholds: { checks: ["rate==1"] },
};

type ApiResponse = { data?: { order_id?: string }; code?: string };

function body(quantity: number): string {
  return JSON.stringify({
    concert_id: CONCERT_ID,
    items: [{ ticket_type_id: TICKET_TYPE_ID, quantity }],
  });
}

function params(token: string, key: string) {
  return {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Idempotency-Key": key,
    },
    tags: { name: "POST /v1/orders (idempotency)" },
  };
}

function json(res: RefinedResponse<ResponseType>): ApiResponse {
  try {
    return res.json() as ApiResponse;
  } catch {
    return {};
  }
}

export function setup(): { runId: string } {
  if (tokens.length < 2) fail("Cần ít nhất 2 access token để test order idempotency.");
  const health = http.get(`${BASE_URL}/health`);
  if (health.status !== 200) fail(`API không sẵn sàng: HTTP ${health.status}`);
  return { runId: Date.now().toString(36) };
}

export default function ({ runId }: { runId: string }): void {
  const url = `${BASE_URL}/orders`;

  // 1. Retry tuần tự: response phải trỏ tới đúng một order.
  const retryKey = `idem-order-retry-${runId}`;
  const first = http.post(url, body(1), params(tokens[0].token, retryKey));
  const retry = http.post(url, body(1), params(tokens[0].token, retryKey));
  const firstId = json(first).data?.order_id;
  check(retry, {
    "order retry: lần đầu tạo thành công": () => first.status === 201 && Boolean(firstId),
    "order retry: trả lại cùng order_id": (res) => res.status === 201 && json(res).data?.order_id === firstId,
  });

  // 2. Cùng key nhưng payload khác phải bị từ chối, không replay nhầm order cũ.
  const changedPayload = http.post(url, body(2), params(tokens[0].token, retryKey));
  check(changedPayload, {
    "order same key khác payload: HTTP 409": (res) => res.status === 409,
    "order same key khác payload: đúng error code": (res) => json(res).code === "IDEMPOTENCY_KEY_REUSED",
  });

  // 3. Concurrent retry: chỉ một execution; request còn lại có thể thấy claim
  // đang chạy hoặc response đã cache nếu request đầu hoàn tất rất nhanh.
  const concurrentKey = `idem-order-concurrent-${runId}`;
  const concurrentParams = params(tokens[1].token, concurrentKey);
  const responses = http.batch([
    { method: "POST", url, body: body(1), params: concurrentParams },
    { method: "POST", url, body: body(1), params: concurrentParams },
  ]);
  const successfulIds = responses
    .filter((res) => res.status === 201)
    .map((res) => json(res).data?.order_id)
    .filter((id): id is string => Boolean(id));
  const winnerId = successfulIds[0];
  check(responses[0], {
    "order concurrent: có request thành công": () => Boolean(winnerId),
    "order concurrent: mọi response hợp lệ": () => responses.every((res) => {
      const code = json(res).code;
      return res.status === 201 || (res.status === 409 && code === "IDEMPOTENCY_IN_PROGRESS");
    }),
    "order concurrent: các response thành công cùng order_id": () => successfulIds.every((id) => id === winnerId),
  });

  const afterConcurrent = http.post(url, body(1), concurrentParams);
  check(afterConcurrent, {
    "order concurrent retry sau hoàn tất trả cùng order_id": (res) =>
      res.status === 201 && json(res).data?.order_id === winnerId,
  });
}
