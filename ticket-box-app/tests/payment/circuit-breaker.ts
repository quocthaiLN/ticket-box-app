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
  // Cần đủ iterations cho: failureThreshold lỗi + vài OPEN + 2 cooldown probe + 3 normal
  const minIterations = failureThreshold + 7 + 3;
  if (totalIterations < minIterations) {
    fail(`PAYMENT_CIRCUIT_TOTAL_ITERATIONS (${totalIterations}) phải ít nhất là ${minIterations} khi failureThreshold=${failureThreshold}.`);
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

// Các mốc iteration dùng computed position thay vì magic number,
// để tự động điều chỉnh theo failureThreshold.
const ITER_FIRST_COOLDOWN = failureThreshold + 5;  // Bước chờ cooldown lần 1 (probe lỗi)
const ITER_RECOVERY     = failureThreshold + 6;  // Bước reset mock + chờ cooldown lần 2 (probe ok)

export default function (data: SetupData): void {
  const iteration = __ITER;
  const orderInfo = data.orders[iteration];

  if (!orderInfo) {
    fail(`Iteration ${iteration} không tìm thấy thông tin order.`);
  }

  console.log(`[Iteration ${iteration + 1}/${totalIterations}] (failureThreshold=${failureThreshold}, firstCooldown@${ITER_FIRST_COOLDOWN}, recovery@${ITER_RECOVERY})`);

  if (iteration === ITER_FIRST_COOLDOWN) {
    // KỊCH BẢN CB-1: Chờ cooldown để OPEN -> HALF_OPEN, probe vẫn lỗi -> OPEN lại
    console.log(`Waiting ${cooldownSeconds}s (cooldown) to allow circuit to transition to HALF_OPEN...`);
    sleep(cooldownSeconds);
  }

  if (iteration === ITER_RECOVERY) {
    // KỊCH BẢN CB-2: Reset MoMo mock + chờ cooldown, probe thành công -> CLOSED
    console.log(`Rescuing MOMO: Setting MOMO mock mode back to '${recoveryMode}'...`);
    const recoveryRes = http.post(
      `${MOMO_MOCK_CONTROL_URL}/__control/momo`,
      JSON.stringify({ mode: recoveryMode }),
      { headers: { "Content-Type": "application/json" } }
    );
    if (recoveryRes.status !== 200) {
      fail(`Không thể khôi phục MOMO mock: HTTP ${recoveryRes.status}`);
    }
    console.log(`Waiting ${cooldownSeconds}s (cooldown) to allow HALF_OPEN for recovery...`);
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
    // Các lỗi trước ngưỡng: lỗi nhưng CB vẫn CLOSED.
    check(response, {
      [`[i=${iteration+1}] Request trước ngưỡng trả 503 PAYMENT_PROVIDER_UNAVAILABLE`]: (res) =>
        res.status === 503 && (res.json() as { code: string }).code === "PAYMENT_PROVIDER_UNAVAILABLE",
      [`[i=${iteration+1}] Circuit Breaker vẫn CLOSED`]: () => cbState === "CLOSED",
    });
  } else if (iteration === failureThreshold - 1) {
    // Lỗi đạt ngưỡng: CB mở ngay sau request này.
    check(response, {
      [`[i=${iteration+1}] Request đạt ngưỡng trả 503`]: (res) => res.status === 503,
      [`[i=${iteration+1}] Circuit Breaker MỞ (OPEN)`]: () => cbState === "OPEN",
    });
  } else if (iteration >= failureThreshold && iteration < ITER_FIRST_COOLDOWN) {
    // CB đang OPEN: bị chặn ngay, không gọi MoMo.
    check(response, {
      [`[i=${iteration+1}] CB OPEN chặn ngay (503)`]: (res) => res.status === 503,
      [`[i=${iteration+1}] Mã lỗi đúng PAYMENT_PROVIDER_UNAVAILABLE`]: (res) =>
        (res.json() as { code: string }).code === "PAYMENT_PROVIDER_UNAVAILABLE",
      [`[i=${iteration+1}] Circuit Breaker vẫn OPEN`]: () => cbState === "OPEN",
    });
  } else if (iteration === ITER_FIRST_COOLDOWN) {
    // Probe HALF_OPEN thất bại (MoMo vẫn lỗi) -> quay OPEN.
    check(response, {
      [`[i=${iteration+1}] Probe HALF_OPEN thất bại (>= 400)`]: (res) => res.status >= 400,
      [`[i=${iteration+1}] CB quay lại OPEN ngay`]: () => cbState === "OPEN",
    });
  } else if (iteration === ITER_RECOVERY) {
    // Probe HALF_OPEN thành công (MoMo đã hồi phục) -> CLOSED.
    check(response, {
      [`[i=${iteration+1}] Probe HALF_OPEN thành công (201)`]: (res) => res.status === 201,
      [`[i=${iteration+1}] Circuit Breaker đóng lại (CLOSED)`]: () => cbState === "CLOSED",
    });
  } else {
    // Các request bình thường sau khi CB đóng.
    check(response, {
      [`[i=${iteration+1}] Hoạt động ổn định (201)`]: (res) => res.status === 201,
      [`[i=${iteration+1}] Circuit Breaker duy trì CLOSED`]: () => cbState === "CLOSED",
    });
  }
}

export function teardown(): void {
  // Khôi phục lại trạng thái bình thường cho mock payment
  console.log("Teardown: Resetting mock payment server controls...");
  http.post(`${MOMO_MOCK_CONTROL_URL}/__control/reset`);
}
