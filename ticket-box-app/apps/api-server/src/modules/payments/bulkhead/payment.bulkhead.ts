import { paymentConfig } from '@ticket-box/config/payment.js';

export class BulkheadRejectedError extends Error {
  readonly statusCode = 503;
  readonly code = 'PAYMENT_PROVIDER_UNAVAILABLE';

  constructor(provider: string, active: number, limit: number) {
    super(`Bulkhead limit reached for ${provider}: ${active}/${limit} concurrent slots in use`);
    this.name = 'BulkheadRejectedError';
  }
}

export class PaymentBulkhead {
  private active = 0;
  private readonly provider: string;
  private readonly limit: number;

  constructor(provider: string, limit: number) {
    this.provider = provider;
    this.limit = limit;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.limit) {
      throw new BulkheadRejectedError(this.provider, this.active, this.limit);
    }

    this.active++;
    try {
      return await fn();
    } finally {
      this.active--;
    }
  }

  getStatus() {
    return {
      provider: this.provider,
      active: this.active,
      limit: this.limit,
      available: this.limit - this.active,
    };
  }
}

export const vnpayBulkhead = new PaymentBulkhead('VNPAY', paymentConfig.vnpay.bulkheadLimit);
export const momoBulkhead = new PaymentBulkhead('MOMO', paymentConfig.momo.bulkheadLimit);

export function getBulkhead(provider: 'VNPAY' | 'MOMO'): PaymentBulkhead {
  return provider === 'VNPAY' ? vnpayBulkhead : momoBulkhead;
}
