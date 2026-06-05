import type { CreateOrderRequest } from './order.type.js';

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult<T> {
  value?: T;
  errors: ValidationError[];
}

export function validateCreateOrderRequest(body: unknown): ValidationResult<CreateOrderRequest> {
  const errors: ValidationError[] = [];
  const b = body as Record<string, unknown>;

  if (!b.concert_id || typeof b.concert_id !== 'string' || b.concert_id.trim() === '') {
    errors.push({ field: 'concert_id', message: 'concert_id is required' });
  }

  if (!Array.isArray(b.items) || b.items.length === 0) {
    errors.push({ field: 'items', message: 'items must be a non-empty array' });
  } else {
    (b.items as unknown[]).forEach((item, i) => {
      const it = item as Record<string, unknown>;
      if (!it.ticket_type_id || typeof it.ticket_type_id !== 'string' || it.ticket_type_id.trim() === '') {
        errors.push({ field: `items[${i}].ticket_type_id`, message: 'ticket_type_id is required' });
      }
      if (typeof it.quantity !== 'number' || !Number.isInteger(it.quantity) || it.quantity <= 0) {
        errors.push({ field: `items[${i}].quantity`, message: 'quantity must be a positive integer' });
      }
    });
  }

  if (b.payment_provider !== undefined) {
    if (b.payment_provider !== 'VNPAY' && b.payment_provider !== 'MOMO') {
      errors.push({ field: 'payment_provider', message: 'payment_provider must be VNPAY or MOMO' });
    }
  }

  if (errors.length > 0) return { errors };
  return { value: b as unknown as CreateOrderRequest, errors: [] };
}
