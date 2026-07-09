import http from "k6/http";
import { check, fail, sleep } from "k6";
import { Counter } from "k6/metrics";
import { SharedArray } from "k6/data";

function getEnv(name: string, fallback: string): string {
  const value = __ENV[name];
  return value === undefined ? fallback : value;
}

const BASE_URL = getEnv("BASE_URL", "http://host.docker.internal:3000/v1").replace(/\/$/, "");
const MOMO_MOCK_CONTROL_URL = getEnv("MOMO_MOCK_CONTROL_URL", "http://host.docker.internal:4101");
const totalIterations = Number.parseInt(getEnv("PAYMENT_CIRCUIT_TOTAL_ITERATIONS", "15"), 10);
const failureThreshold = Number.parseInt(getEnv("PAYMENT_CIRCUIT_FAILURE_THRESHOLD", "2"), 10);
const cooldownSeconds = Number.parseInt(getEnv("PAYMENT_CIRCUIT_COOLDOWN_SECONDS", "6"), 10);
const failMode = getEnv("PAYMENT_CIRCUIT_FAIL_MODE", "fail");
const recoveryMode = getEnv("PAYMENT_CIRCUIT_RECOVERY_MODE", "ok");
const concertId = getEnv("PAYMENT_CIRCUIT_CONCERT_ID", "00000000-0000-0000-0000-000000000202");
const ticketTypeId = getEnv("PAYMENT_CIRCUIT_TICKET_TYPE_ID", "00000000-0000-0000-0000-000000000510");

// Load tokens.json đã sinh sẵn
const allTokens = new SharedArray("loadtest_tokens", function () {
  return JSON.parse(open("../order/tokens.json"));
});

export const options = {
  scenarios: {
    circuit_breaker_test: {
      executor: "shared-iterations",
      vus: 1, // Chạy tuần tự bằng 1 VU để kiểm tra trạng thái chuyển đổi chính xác
      iterations: totalIterations,
      maxDuration: "2m",
    },
  },
  thresholds: {
    checks: ["rate==1"],
  },
};

type OrderData = { orderId: string; token: string };
type SetupData = { orders: OrderData[]; runId: string };

export function setup(): SetupData {
  if (totalIterations < 12) {
    fail(`PAYMENT_CIRCUIT_TOTAL_ITERATIONS (${totalIterations}) phải ít nhất là 12.`);
  }
  if (failureThreshold < 1 || failureThreshold > 10) {
    fail(`PAYMENT_CIRCUIT_FAILURE_THRESHOLD (${failureThreshold}) phải từ 1 đến 10.`);
  }

  const healthRes = http.get(`${MOMO_MOCK_CONTROL_URL}/health`);
  if (healthRes.status !== 200) {
    fail(
      `MoMo mock không sẵn sàng tại ${MOMO_MOCK_CONTROL_URL} ` +
      `(HTTP ${healthRes.status}). Hãy chạy "npm run dev:payment:momo" trước khi chạy k6.`,
    );
  }

  const runId = String(Date.now());

  // 1. Reset trạng thái mock payment server về bình thường
  console.log("Resetting mock payment server controls...");
  const resetRes = http.post(`${MOMO_MOCK_CONTROL_URL}/__control/reset`);
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
          "Idempotency-Key": `circuit-order-${runId}-${i}`,
        },
      }
    );

    if (orderRes.status !== 201) {
      fail(`Tạo order thất bại cho user ${i}: HTTP ${orderRes.status} - ${orderRes.body}`);
    }

    const orderId = (orderRes.json() as { data: { order_id: string } }).data.order_id;
    orders.push({ orderId, token });
  }

  // 3. MoMo checkout gọi network nên có thể kích hoạt circuit breaker.
  // VNPay checkout chỉ ký URL nội bộ và không gọi QueryDR ở endpoint này.
  console.log("Injecting fault: Setting MOMO mock mode to 'fail'...");
  const controlRes = http.post(
    `${MOMO_MOCK_CONTROL_URL}/__control/momo`,
    JSON.stringify({
      mode: failMode,
    }),
    {
      headers: { "Content-Type": "application/json" },
    }
  );

  if (controlRes.status !== 200) {
    fail(`Không thể cấu hình MOMO lỗi: HTTP ${controlRes.status}`);
  }

  return { orders, runId };
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
    // KỊCH BẢN CB-1: Chờ cooldown để OPEN -> HALF_OPEN
    console.log(`Waiting ${cooldownSeconds} seconds (cooldown) to allow circuit to transition to HALF_OPEN...`);
    sleep(cooldownSeconds);
  }

  if (iteration === 11) {
    // KỊCH BẢN CB-2: Khôi phục cổng MOMO hoạt động lại bình thường
    console.log(`Rescuing MOMO: Setting MOMO mock mode back to '${recoveryMode}'...`);
    const recoveryRes = http.post(
      `${MOMO_MOCK_CONTROL_URL}/__control/momo`,
      JSON.stringify({ mode: recoveryMode }),
      { headers: { "Content-Type": "application/json" } }
    );
    if (recoveryRes.status !== 200) {
      fail(`Không thể khôi phục MOMO mock: HTTP ${recoveryRes.status}`);
    }
    // Chờ cooldown tiếp theo trước khi gọi request khôi phục mạch
    console.log(`Waiting ${cooldownSeconds} seconds (cooldown) to allow transition to HALF_OPEN for recovery...`);
    sleep(cooldownSeconds);
  }

  // Gửi request thanh toán qua MoMo để đi qua network circuit breaker.
  const response = http.post(
    `${BASE_URL}/orders/${orderInfo.orderId}/payments`,
    JSON.stringify({
      payment_provider: "MOMO",
    }),
    {
      headers: {
        Authorization: `Bearer ${orderInfo.token}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `circuit-payment-${data.runId}-${iteration}`,
      },
      tags: { name: "POST /v1/orders/:id/payments (MOMO)" },
    }
  );

  // Lấy trạng thái Circuit Breaker qua API health check
  const healthRes = http.get(`${BASE_URL}/payments/health`);
  if (healthRes.status !== 200 && healthRes.status !== 503) {
    fail(`Không đọc được payment health: HTTP ${healthRes.status} - ${healthRes.body}`);
  }
  const healthData = healthRes.json() as { providers: { momo: { circuitBreaker: { state: string } } } };
  const cbState = healthData.providers.momo.circuitBreaker.state;

  console.log(`Request Status: ${response.status} | Circuit Breaker State: ${cbState}`);

  if (iteration < failureThreshold - 1) {
    // Các lỗi trước ngưỡng chưa mở mạch.
    check(response, {
      "Request trước ngưỡng trả PAYMENT_PROVIDER_UNAVAILABLE": (res) =>
        res.status === 503 && (res.json() as { code: string }).code === "PAYMENT_PROVIDER_UNAVAILABLE",
      "Circuit Breaker vẫn ở trạng thái CLOSED": () => cbState === "CLOSED",
    });
  } else if (iteration === failureThreshold - 1) {
    // Request đạt ngưỡng sẽ mở mạch ngay sau lỗi.
    check(response, {
      "Request đạt ngưỡng trả status 503": (res) => res.status === 503,
      "Circuit Breaker mở khi đủ ngưỡng lỗi": () => cbState === "OPEN",
    });
  } else if (iteration >= failureThreshold && iteration <= 9) {
    // Các request tiếp theo bị circuit OPEN chặn ngay.
    check(response, {
      "Request sau ngưỡng bị chặn ngay lập tức (status 503)": (res) => res.status === 503,
      "Mã code lỗi đúng Circuit Open": (res) => (res.json() as { code: string }).code === "PAYMENT_PROVIDER_UNAVAILABLE",
      "Circuit Breaker đã chuyển sang trạng thái OPEN": () => cbState === "OPEN",
    });
  } else if (iteration === 10) {
    // Request 11: HALF_OPEN probe vẫn lỗi nên quay lại OPEN.
    check(response, {
      "Request thăm dò ở HALF_OPEN thất bại (status >= 400)": (res) => res.status >= 400,
      "Circuit Breaker quay trở lại OPEN ngay lập tức": () => cbState === "OPEN",
    });
  } else if (iteration === 11) {
    // Request 12: MoMo đã hồi phục, HALF_OPEN probe thành công và đóng mạch.
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
  http.post(`${MOMO_MOCK_CONTROL_URL}/__control/reset`);
}
