import http from "k6/http";
import { check, fail, sleep } from "k6";
import { Counter } from "k6/metrics";
import { SharedArray } from "k6/data";

const BASE_URL = (__ENV.BASE_URL ?? "http://host.docker.internal:3000/v1").replace(/\/$/, "");
const MOCK_CONTROL_URL = __ENV.MOCK_CONTROL_URL ?? "http://host.docker.internal:4100";

// Load tokens.json đã sinh sẵn
const allTokens = new SharedArray("loadtest_tokens", function () {
  return JSON.parse(open("../order/tokens.json"));
});

const totalIterations = 15;

export const options = {
  scenarios: {
    circuit_breaker_test: {
      executor: "shared-iterations",
      vus: 1, // Chạy tuần tự bằng 1 VU để kiểm tra trạng thái chuyển đổi chính xác
      iterations: totalIterations,
      maxDuration: "2m",
    },
  },
};

type OrderData = { orderId: string; token: string };
type SetupData = { orders: OrderData[] };

export function setup(): SetupData {
  // 1. Reset trạng thái mock payment server về bình thường
  console.log("Resetting mock payment server controls...");
  const resetRes = http.post(`${MOCK_CONTROL_URL}/__control/reset`);
  if (resetRes.status !== 200) {
    fail(`Không thể reset mock payment server: HTTP ${resetRes.status}`);
  }

  // 2. Tạo sẵn các HELD orders cho test circuit breaker
  console.log(`Creating ${totalIterations} HELD orders for circuit breaker test...`);
  const orders: OrderData[] = [];

  for (let i = 0; i < totalIterations; i++) {
    const token = allTokens[i].token;
    
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

  // 3. Tiêm lỗi: Cấu hình VNPAY bị hỏng hoàn toàn (mode = fail)
  console.log("Injecting fault: Setting VNPAY mock mode to 'fail'...");
  const controlRes = http.post(
    `${MOCK_CONTROL_URL}/__control/vnpay`,
    JSON.stringify({
      mode: "fail",
    }),
    {
      headers: { "Content-Type": "application/json" },
    }
  );

  if (controlRes.status !== 200) {
    fail(`Không thể cấu hình VNPAY lỗi: HTTP ${controlRes.status}`);
  }

  return { orders };
}

export default function (data: SetupData): void {
  const iteration = __ITER;
  const orderInfo = data.orders[iteration];
  
  if (!orderInfo) {
    fail(`Iteration ${iteration} không tìm thấy thông tin order.`);
  }

  console.log(`[Iteration ${iteration + 1}/${totalIterations}]`);

  // Thực hiện các kịch bản dựa theo chỉ số iteration:
  
  if (iteration === 10) {
    // KỊCH BẢN CB-1: Chờ 6 giây (vượt resetTimeout = 5 giây) để OPEN -> HALF_OPEN
    console.log("Waiting 6 seconds (cooldown) to allow circuit to transition to HALF_OPEN...");
    sleep(6);
  }

  if (iteration === 11) {
    // KỊCH BẢN CB-2: Cứu hộ cổng VNPAY hoạt động lại bình thường
    console.log("Rescuing VNPAY: Setting VNPAY mock mode back to 'ok'...");
    http.post(
      `${MOCK_CONTROL_URL}/__control/vnpay`,
      JSON.stringify({ mode: "ok" }),
      { headers: { "Content-Type": "application/json" } }
    );
    // Chờ 6 giây tiếp theo để cooldown trước khi gọi request khôi phục mạch
    console.log("Waiting 6 seconds (cooldown) to allow transition to HALF_OPEN for recovery...");
    sleep(6);
  }

  // Gửi request thanh toán qua VNPay
  const response = http.post(
    `${BASE_URL}/orders/${orderInfo.orderId}/payments`,
    JSON.stringify({
      payment_provider: "VNPAY",
    }),
    {
      headers: {
        Authorization: `Bearer ${orderInfo.token}`,
        "Content-Type": "application/json",
      },
      tags: { name: "POST /v1/orders/:id/payments (VNPAY)" },
    }
  );

  // Lấy trạng thái Circuit Breaker qua API health check
  const healthRes = http.get(`${BASE_URL}/payments/health`);
  const healthData = healthRes.json() as { providers: { vnpay: { circuitBreaker: { state: string } } } };
  const cbState = healthData.providers.vnpay.circuitBreaker.state;

  console.log(`Request Status: ${response.status} | Circuit Breaker State: ${cbState}`);

  if (iteration < 5) {
    // 5 requests đầu: mạch CLOSED, lỗi phát sinh từ mock server (thường là 500 hoặc 400 tùy logic API)
    check(response, {
      "5 requests đầu bị lỗi do VNPAY hỏng (status >= 400)": (res) => res.status >= 400,
      "Circuit Breaker vẫn ở trạng thái CLOSED": () => cbState === "CLOSED",
    });
  } else if (iteration >= 5 && iteration <= 9) {
    // Từ request thứ 6 đến 10: mạch đã OPEN, API chặn ngay lập tức và trả về lỗi 503
    check(response, {
      "Từ request thứ 6 trở đi bị chặn ngay lập tức (status 503)": (res) => res.status === 503,
      "Mã code lỗi đúng Circuit Open": (res) => (res.json() as { code: string }).code === "PAYMENT_PROVIDER_UNAVAILABLE",
      "Circuit Breaker đã chuyển sang trạng thái OPEN": () => cbState === "OPEN",
    });
  } else if (iteration === 10) {
    // Request thứ 11 (sau cooldown): Mạch chuyển HALF_OPEN -> gửi thử request -> thất bại vì VNPAY vẫn hỏng -> quay lại OPEN
    check(response, {
      "Request thăm dò ở HALF_OPEN thất bại (status >= 400)": (res) => res.status >= 400,
      "Circuit Breaker quay trở lại OPEN ngay lập tức": () => cbState === "OPEN",
    });
  } else if (iteration === 11) {
    // Request thứ 12 (sau khi VNPAY hồi phục & cooldown): Mạch chuyển HALF_OPEN -> gửi request -> thành công -> quay về CLOSED
    check(response, {
      "Request thăm dò khi VNPAY hồi phục thành công (status 201)": (res) => res.status === 201,
      "Circuit Breaker được khôi phục về CLOSED": () => cbState === "CLOSED",
    });
  } else {
    // Các requests còn lại chạy bình thường thành công
    check(response, {
      "Các request sau hoạt động ổn định (status 201)": (res) => res.status === 201,
      "Circuit Breaker duy trì CLOSED": () => cbState === "CLOSED",
    });
  }
}

export function teardown(): void {
  // Khôi phục lại trạng thái bình thường cho mock payment
  console.log("Teardown: Resetting mock payment server controls...");
  http.post(`${MOCK_CONTROL_URL}/__control/reset`);
}
