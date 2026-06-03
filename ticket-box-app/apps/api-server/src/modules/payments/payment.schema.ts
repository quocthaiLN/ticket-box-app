import type { RetryPaymentRequest } from './payment.type.js';

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult<T> {
  value?: T;
  errors: ValidationError[];
}

export function validateRetryPaymentRequest(body: unknown): ValidationResult<RetryPaymentRequest> {
  const errors: ValidationError[] = [];
  const b = (body ?? {}) as Record<string, unknown>;

  if (b.payment_provider !== undefined) {
    if (b.payment_provider !== 'VNPAY' && b.payment_provider !== 'MOMO') {
      errors.push({ field: 'payment_provider', message: 'payment_provider must be VNPAY or MOMO' });
    }
  }

  if (errors.length > 0) return { errors };
  return { value: b as RetryPaymentRequest, errors: [] };
}
