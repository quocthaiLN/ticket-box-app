import http from "k6/http";
import { check, fail } from "k6";
import { Counter, Trend } from "k6/metrics";
import { SharedArray } from "k6/data";

const BASE_URL = (__ENV.BASE_URL ?? "http://host.docker.internal:3000/v1").replace(/\/$/, "");
const MOCK_CONTROL_URL = __ENV.MOCK_CONTROL_URL ?? "http://host.docker.internal:4100";

// Load tokens.json đã sinh sẵn
const allTokens = new SharedArray("loadtest_tokens", function () {
  return JSON.parse(open("../order/tokens.json"));
});

const bulkheadLimit = 20; // Khớp với MOMO_BULKHEAD_LIMIT mặc định
const testVUs = 35; // Số lượng VU gửi yêu cầu đồng thời (lớn hơn giới hạn bulkhead)

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
    // Chúng ta mong đợi một số request bị từ chối nhanh chóng (lỗi 503)
    "http_req_duration{name:POST /v1/orders/:id/payments (MOMO)}": ["p(95) > 0"], 
  },
};

const bulkheadRejected = new Counter("payment_bulkhead_rejected");
const bulkheadAccepted = new Counter("payment_bulkhead_accepted");
const executionTime = new Trend("payment_execution_time");

type OrderData = { orderId: string; token: string };
type SetupData = { orders: OrderData[] };

export function setup(): SetupData {
  // 1. Reset trạng thái mock payment server về bình thường
  console.log("Resetting mock payment server controls...");
  const resetRes = http.post(`${MOCK_CONTROL_URL}/__control/reset`);
  if (resetRes.status !== 200) {
    fail(`Không thể reset mock payment server: HTTP ${resetRes.status}`);
  }

  // 2. Tạo sẵn các HELD orders cho các VUs thanh toán
  console.log(`Creating ${testVUs} HELD orders for bulkhead test...`);
  const orders: OrderData[] = [];

  for (let i = 0; i < testVUs; i++) {
    const token = allTokens[i].token;
    
    // Gọi API tạo order
    const orderRes = http.post(
      `${BASE_URL}/orders`,
      JSON.stringify({
        concert_id: "00000000-0000-0000-0000-000000000202",
        items: [
          {
            ticket_type_id: "00000000-0000-0000-0000-000000000510", // GA
            quantity: 1,
          },
        ],
      }),
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (orderRes.status !== 201) {
      fail(`Tạo order thất bại cho user ${i}: HTTP ${orderRes.status} - ${orderRes.body}`);
    }

    const orderId = (orderRes.json() as { data: { order_id: string } }).data.order_id;
    orders.push({ orderId, token });
  }

  // 3. Tiêm lỗi (Fault Injection): Đặt cổng MOMO phản hồi siêu chậm (5 giây)
  console.log("Injecting fault: Setting MOMO mock latency to 5000ms (saturate bulkhead)...");
  const controlRes = http.post(
    `${MOCK_CONTROL_URL}/__control/momo`,
    JSON.stringify({
      mode: "timeout",
      latencyMs: 5000,
    }),
    {
      headers: { "Content-Type": "application/json" },
    }
  );

  if (controlRes.status !== 200) {
    fail(`Không thể tiêm lỗi vào MOMO: HTTP ${controlRes.status}`);
  }

  return { orders };
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
      },
      tags: { name: "POST /v1/orders/:id/payments (MOMO)" },
      timeout: "10s", // Cho phép chờ tối đa 10s vì mock latency là 5s
    }
  );

  const duration = Date.now() - startTime;
  executionTime.add(duration);

  const isRejected = response.status === 503;
  const isAccepted = response.status === 201;

  if (isRejected) {
    bulkheadRejected.add(1);
  } else if (isAccepted) {
    bulkheadAccepted.add(1);
  }

  check(response, {
    "Phản hồi nhanh khi bị Bulkhead Reject (< 200ms)": (res) => {
      if (res.status !== 503) return true; // Bỏ qua nếu thành công
      return duration < 200; // Phải trả về lỗi ngay lập tức (fail-fast)
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
      if (res.status !== 201) return true;
      return duration >= 5000;
    },
  });
}

export function teardown(): void {
  // Khôi phục lại trạng thái bình thường cho mock payment
  console.log("Teardown: Resetting mock payment server controls...");
  http.post(`${MOCK_CONTROL_URL}/__control/reset`);
}
