import { paymentConfig } from '@ticketbox/config/payment.js';

// CLOSED: cho phép gọi; OPEN: chặn gọi; HALF_OPEN: cho một request thử khôi phục.
export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

// Ngưỡng lỗi và thời gian chờ trước khi thử gọi lại provider.
interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  halfOpenSuccessThreshold?: number;
}

// Lỗi 503 trả về khi provider đang bị circuit breaker cô lập.
export class CircuitOpenError extends Error {
  readonly statusCode = 503;
  readonly code = 'PAYMENT_PROVIDER_UNAVAILABLE';

  // Không gọi provider thật khi circuit đang OPEN để tránh làm lỗi lan rộng.
  constructor(provider: string) {
    super(`Payment provider ${provider} is currently unavailable (circuit open)`);
    this.name = 'CircuitOpenError';
  }
}

export class PaymentCircuitBreaker {
  // Trạng thái và bộ đếm được quản lý độc lập cho từng provider trong process.
  private state: CircuitState = 'CLOSED'; // Trạng thái hiện tại của circuit breaker.
  private failureCount = 0; // Số request lỗi liên tiếp khi circuit đang CLOSED.
  private successCount = 0; // Số probe thành công liên tiếp khi circuit đang HALF_OPEN.
  private lastFailureTime: number | undefined; // Mốc thời gian lỗi gần nhất để tính cooldown.
  private halfOpenProbeInFlight = false; // Đánh dấu đã có một request thử khôi phục đang chạy.

  private readonly provider: string; // Provider mà circuit breaker này bảo vệ.
  private readonly failureThreshold: number; // Số lỗi đạt ngưỡng sẽ chuyển CLOSED sang OPEN.
  private readonly resetTimeout: number; // Thời gian chờ trước khi OPEN được thử sang HALF_OPEN.
  private readonly halfOpenSuccessThreshold: number; // Số probe thành công cần có để đóng circuit.

  // Đọc policy circuit breaker từ cấu hình runtime của provider.
  constructor(provider: string, config: CircuitBreakerConfig) {
    this.provider = provider;
    this.failureThreshold = config.failureThreshold;
    this.resetTimeout = config.resetTimeout;
    this.halfOpenSuccessThreshold = config.halfOpenSuccessThreshold ?? 1;
  }

  // Bọc một request provider, cập nhật circuit theo kết quả request đó.
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // OPEN có thể chuyển sang HALF_OPEN sau reset timeout hoặc từ chối ngay.
    this.checkState();

    if (this.state === 'HALF_OPEN') {
      // Chỉ cho phép một probe tại một thời điểm để tránh nhiều request cùng thử lại.
      if (this.halfOpenProbeInFlight) {
        throw new CircuitOpenError(this.provider);
      }
      this.halfOpenProbeInFlight = true;
    }

    try {
      // Request thành công giúp đóng circuit hoặc reset failure counter.
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      // Request lỗi làm tăng failure counter hoặc mở lại circuit đang thử khôi phục.
      this.onFailure();
      throw err;
    }
  }

  // Ghi nhận lỗi từ luồng không đi qua execute, ví dụ webhook payment thất bại.
  recordFailure(): void {
    this.onFailure();
  }

  // Ghi nhận thành công từ luồng không đi qua execute, ví dụ webhook payment thành công.
  recordSuccess(): void {
    this.onSuccess();
  }

  // Cho caller biết có nên bỏ qua provider này trước khi bắt đầu gọi hay không.
  isOpen(): boolean {
    if (this.state === 'OPEN') {
      return !this.canAttemptReset();
    }
    return false;
  }

  // Trả về trạng thái quan sát được cho health check/monitoring.
  getStatus() {
    return {
      provider: this.provider,
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
      nextRetryAt: this.state === 'OPEN' && this.lastFailureTime
        ? new Date(this.lastFailureTime + this.resetTimeout).toISOString()
        : null,
    };
  }

  // Chuyển OPEN sang HALF_OPEN khi đã qua thời gian cooldown; nếu chưa thì chặn.
  private checkState(): void {
    if (this.state === 'OPEN') {
      if (this.canAttemptReset()) {
        this.transitionTo('HALF_OPEN');
      } else {
        throw new CircuitOpenError(this.provider);
      }
    }
  }

  // Chỉ được probe lại sau khoảng thời gian chờ kể từ lỗi gần nhất.
  private canAttemptReset(): boolean {
    return this.lastFailureTime !== undefined &&
      Date.now() - this.lastFailureTime >= this.resetTimeout;
  }

  // HALF_OPEN cần đủ số probe thành công mới đóng circuit; CLOSED chỉ reset lỗi.
  private onSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      this.halfOpenProbeInFlight = false;
      this.successCount++;
      if (this.successCount >= this.halfOpenSuccessThreshold) {
        this.transitionTo('CLOSED');
      }
    } else if (this.state === 'CLOSED') {
      this.failureCount = 0;
    }
  }

  // Lỗi ở HALF_OPEN mở lại ngay; lỗi ở CLOSED chỉ mở khi vượt ngưỡng.
  private onFailure(): void {
    this.lastFailureTime = Date.now();

    if (this.state === 'HALF_OPEN') {
      this.halfOpenProbeInFlight = false;
      this.transitionTo('OPEN');
      return;
    }

    this.failureCount++;
    if (this.failureCount >= this.failureThreshold) {
      this.transitionTo('OPEN');
    }
  }

  // Chuyển trạng thái và reset các bộ đếm không còn hợp lệ ở trạng thái mới.
  private transitionTo(next: CircuitState): void {
    this.state = next;
    if (next === 'CLOSED') {
      this.failureCount = 0;
      this.successCount = 0;
      this.halfOpenProbeInFlight = false;
    } else if (next === 'HALF_OPEN') {
      this.successCount = 0;
      this.halfOpenProbeInFlight = false;
    }
  }
}

// Hai circuit độc lập để sự cố một provider không chặn provider còn lại.
export const vnpayCircuitBreaker = new PaymentCircuitBreaker('VNPAY', {
  failureThreshold: paymentConfig.vnpay.failureThreshold,
  resetTimeout: paymentConfig.vnpay.resetTimeout,
});

export const momoCircuitBreaker = new PaymentCircuitBreaker('MOMO', {
  failureThreshold: paymentConfig.momo.failureThreshold,
  resetTimeout: paymentConfig.momo.resetTimeout,
});

// Trả về circuit breaker tương ứng với provider đang được gọi.
export function getCircuitBreaker(provider: 'VNPAY' | 'MOMO'): PaymentCircuitBreaker {
  return provider === 'VNPAY' ? vnpayCircuitBreaker : momoCircuitBreaker;
}

/*
Luồng gọi trong payment service:
  buildCheckoutUrlWithFallback() -> callProvider() -> bulkhead.execute()
  -> circuitBreaker.execute(fn) -> payment provider.

execute(fn):
  1. checkState(): CLOSED cho phép gọi; OPEN chưa hết cooldown ném CircuitOpenError;
     OPEN hết cooldown chuyển sang HALF_OPEN.
  2. HALF_OPEN chỉ cho một probe chạy; probe thứ hai bị từ chối.
  3. fn thành công gọi onSuccess(); fn lỗi gọi onFailure() rồi ném lại lỗi gốc.

Chuyển trạng thái:
  CLOSED    -- đủ failureThreshold lỗi --> OPEN
  OPEN      -- hết resetTimeout ----------> HALF_OPEN
  HALF_OPEN -- đủ probe thành công -------> CLOSED
  HALF_OPEN -- probe lỗi -----------------> OPEN

recordSuccess() và recordFailure() dùng cho các luồng không đi qua execute(),
ví dụ kết quả webhook từ VNPAY hoặc MoMo. isOpen() giúp caller bỏ qua provider
đang OPEN trước khi thử gọi, còn getStatus() cung cấp dữ liệu monitoring.
*/