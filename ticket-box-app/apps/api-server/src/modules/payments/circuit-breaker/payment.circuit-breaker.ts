import { paymentConfig } from '@ticket-box/config/payment.js';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  halfOpenSuccessThreshold?: number;
}

export class CircuitOpenError extends Error {
  readonly statusCode = 503;
  readonly code = 'PAYMENT_PROVIDER_UNAVAILABLE';

  constructor(provider: string) {
    super(`Payment provider ${provider} is currently unavailable (circuit open)`);
    this.name = 'CircuitOpenError';
  }
}

export class PaymentCircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime: number | undefined;
  private halfOpenProbeInFlight = false;

  private readonly provider: string;
  private readonly failureThreshold: number;
  private readonly resetTimeout: number;
  private readonly halfOpenSuccessThreshold: number;

  constructor(provider: string, config: CircuitBreakerConfig) {
    this.provider = provider;
    this.failureThreshold = config.failureThreshold;
    this.resetTimeout = config.resetTimeout;
    this.halfOpenSuccessThreshold = config.halfOpenSuccessThreshold ?? 1;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.checkState();

    if (this.state === 'HALF_OPEN') {
      if (this.halfOpenProbeInFlight) {
        throw new CircuitOpenError(this.provider);
      }
      this.halfOpenProbeInFlight = true;
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  recordFailure(): void {
    this.onFailure();
  }

  recordSuccess(): void {
    this.onSuccess();
  }

  isOpen(): boolean {
    if (this.state === 'OPEN') {
      return !this.canAttemptReset();
    }
    return false;
  }

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

  private checkState(): void {
    if (this.state === 'OPEN') {
      if (this.canAttemptReset()) {
        this.transitionTo('HALF_OPEN');
      } else {
        throw new CircuitOpenError(this.provider);
      }
    }
  }

  private canAttemptReset(): boolean {
    return this.lastFailureTime !== undefined &&
      Date.now() - this.lastFailureTime >= this.resetTimeout;
  }

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

export const vnpayCircuitBreaker = new PaymentCircuitBreaker('VNPAY', {
  failureThreshold: paymentConfig.vnpay.failureThreshold,
  resetTimeout: paymentConfig.vnpay.resetTimeout,
});

export const momoCircuitBreaker = new PaymentCircuitBreaker('MOMO', {
  failureThreshold: paymentConfig.momo.failureThreshold,
  resetTimeout: paymentConfig.momo.resetTimeout,
});

export function getCircuitBreaker(provider: 'VNPAY' | 'MOMO'): PaymentCircuitBreaker {
  return provider === 'VNPAY' ? vnpayCircuitBreaker : momoCircuitBreaker;
}
