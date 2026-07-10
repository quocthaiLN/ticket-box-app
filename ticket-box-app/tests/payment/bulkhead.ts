import http from "k6/http";
import { check, fail } from "k6";
import { Counter, Trend } from "k6/metrics";
import { SharedArray } from "k6/data";

function getEnv(name: string, fallback: string): string {
  const value = __ENV[name];
  return value === undefined ? fallback : value;
}

const BASE_URL = getEnv("BASE_URL", "http://host.docker.internal:3000/v1").replace(/\/$/, "");
const MOMO_MOCK_CONTROL_URL = getEnv("MOMO_MOCK_CONTROL_URL", "http://host.docker.internal:4101");
const bulkheadLimit = Number.parseInt(getEnv("PAYMENT_BULKHEAD_LIMIT", "20"), 10);
const testVUs = Number.parseInt(getEnv("PAYMENT_BULKHEAD_VUS", "35"), 10);
const mockLatencyMs = Number.parseInt(getEnv("PAYMENT_BULKHEAD_LATENCY_MS", "5000"), 10);
const paymentTimeoutMs = Number.parseInt(getEnv("PAYMENT_BULKHEAD_TIMEOUT_MS", "10000"), 10);
const concertId = getEnv("PAYMENT_BULKHEAD_CONCERT_ID", "00000000-0000-0000-0000-000000000202");
const ticketTypeId = getEnv("PAYMENT_BULKHEAD_TICKET_TYPE_ID", "00000000-0000-0000-0000-000000000510");

// Load tokens.json đã sinh sẵn
const allTokens = new SharedArray("loadtest_tokens", function () {
  return JSON.parse(open("../generate-tokens/tokens.json"));
});

export const options = {
  scenarios: {
    bulkhead_test: {
      executor: "per-vu-iterations",
      vus: testVUs,
      iterations: 1,
      maxDuration: "30s",
    },
  },
  thresholds: {
    checks: ["rate==1"],
    payment_bulkhead_rejected: ["count>0"],
    payment_bulkhead_accepted: ["count>0"],
  },
};

const bulkheadRejected = new Counter("payment_bulkhead_rejected");
const bulkheadAccepted = new Counter("payment_bulkhead_accepted");
const executionTime = new Trend("payment_execution_time");

type OrderData = { orderId: string; token: string };
type SetupData = { orders: OrderData[]; runId: string };

export function setup(): SetupData {
  if (testVUs <= bulkheadLimit) {
    fail(`PAYMENT_BULKHEAD_VUS (${testVUs}) phải lớn hơn PAYMENT_BULKHEAD_LIMIT (${bulkheadLimit}).`);
  }
  if (paymentTimeoutMs <= mockLatencyMs) {
    fail(`PAYMENT_BULKHEAD_TIMEOUT_MS (${paymentTimeoutMs}) phải lớn hơn PAYMENT_BULKHEAD_LATENCY_MS (${mockLatencyMs}).`);
  }

  const runId = String(Date.now());

  // 1. Kiểm tra mock server trước để lỗi thiếu service có thông báo rõ ràng.
  const healthRes = http.get(`${MOMO_MOCK_CONTROL_URL}/health`);
  if (healthRes.status !== 200) {
    fail(
      `MoMo mock không sẵn sàng tại ${MOMO_MOCK_CONTROL_URL} ` +
      `(HTTP ${healthRes.status}). Hãy chạy "npm run dev:payment:momo" trước khi chạy k6.`,
    );
  }

  // Reset trạng thái mock payment server về bình thường.
  console.log("Resetting mock payment server controls...");
  const resetRes = http.post(`${MOMO_MOCK_CONTROL_URL}/__control/reset`);
  if (resetRes.status !== 200) {
    fail(`Không thể reset mock payment server: HTTP ${resetRes.status}`);
  }

  // 2. Tạo sẵn các HELD orders cho các VUs thanh toán.
  console.log(`Creating ${testVUs} HELD orders for bulkhead test...`);
  const orders: OrderData[] = [];

  for (let i = 0; i < testVUs; i++) {
    const token = allTokens[i].token;

    // Gọi API tạo order
    const orderRes = http.post(
      `${BASE_URL}/orders`,
      JSON.stringify({
        concert_id: concertId,
        items: [
          {
            ticket_type_id: ticketTypeId,
            quantity: 1,
          },
        ],
      }),
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `bulkhead-order-${runId}-${i}`,
        },
      }
    );

    if (orderRes.status !== 201) {
      fail(`Tạo order thất bại cho user ${i}: HTTP ${orderRes.status} - ${orderRes.body}`);
    }

    const orderId = (orderRes.json() as { data: { order_id: string } }).data.order_id;
    orders.push({ orderId, token });
  }

  // 3. Cho MoMo phản hồi thành công nhưng chậm để giữ đầy các slot bulkhead.
  // Không dùng mode=timeout vì khi đó request chiếm được slot cũng trả 503,
  // không thể phân biệt với request bị bulkhead từ chối.
  console.log(`Setting MOMO mock latency to ${mockLatencyMs}ms (saturate bulkhead)...`);
  const controlRes = http.post(
    `${MOMO_MOCK_CONTROL_URL}/__control/momo`,
    JSON.stringify({
      mode: "ok",
      latencyMs: mockLatencyMs,
    }),
    {
      headers: { "Content-Type": "application/json" },
    }
  );

  if (controlRes.status !== 200) {
    fail(`Không thể tiêm lỗi vào MOMO: HTTP ${controlRes.status}`);
  }

  return { orders, runId };
}

export default function (data: SetupData): void {
  // Mỗi VU lấy một order tương ứng
  const vuId = __VU;
  const orderInfo = data.orders[vuId - 1];

  if (!orderInfo) {
    fail(`VU ${vuId} không tìm thấy thông tin order.`);
  }

  const startTime = Date.now();

  // Gửi request thanh toán MoMo đồng thời
  const response = http.post(
    `${BASE_URL}/orders/${orderInfo.orderId}/payments`,
    JSON.stringify({
      payment_provider: "MOMO",
    }),
    {
      headers: {
        Authorization: `Bearer ${orderInfo.token}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `bulkhead-payment-${data.runId}-${vuId}`,
      },
      tags: { name: "POST /v1/orders/:id/payments (MOMO)" },
      timeout: `${paymentTimeoutMs}ms`,
    }
  );

  const duration = Date.now() - startTime;
  executionTime.add(duration);

  // Request hết slot phải bị từ chối nhanh; request lấy được slot sẽ chờ mock
  // rồi thành công. Dùng cả status và duration để tránh phân loại nhầm lỗi 503
  // do provider/API với bulkhead rejection.
  const isRejected = response.status === 503 && duration < 200;
  const isAccepted = response.status === 201 && duration >= mockLatencyMs;

  if (isRejected) {
    bulkheadRejected.add(1);
  } else if (isAccepted) {
    bulkheadAccepted.add(1);
  }

  check(response, {
    "Phản hồi nhanh khi bị Bulkhead Reject (< 200ms)": (res) => {
      if (res.status !== 503) return true;
      return duration < 200;
    },
    "Lỗi trả về đúng mã code PAYMENT_PROVIDER_UNAVAILABLE": (res) => {
      if (res.status !== 503) return true;
      try {
        return (res.json() as { code: string }).code === "PAYMENT_PROVIDER_UNAVAILABLE";
      } catch {
        return false;
      }
    },
    "Request đi vào slot thành công có thời gian xử lý lâu (>= 5s)": (res) => {
      return res.status === 503 || (res.status === 201 && duration >= mockLatencyMs);
    },
    "Chỉ trả về kết quả bulkhead hợp lệ (201 hoặc 503)": (res) =>
      res.status === 201 || res.status === 503,
  });
}

export function teardown(): void {
  // Khôi phục lại trạng thái bình thường cho mock payment
  console.log("Teardown: Resetting mock payment server controls...");
  http.post(`${MOMO_MOCK_CONTROL_URL}/__control/reset`);
}
