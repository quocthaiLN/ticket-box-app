import type {
  HoldRequest,
  ReleaseRequest,
  PaymentConfirmationRequest,
  InventoryAdjustmentRequest,
} from './inventory.type.js';

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult<T> {
  value?: T;
  errors: ValidationError[];
}

export function validateHoldRequest(body: unknown): ValidationResult<HoldRequest> {
  const errors: ValidationError[] = [];
  const b = body as Record<string, unknown>;

  if (!b.user_id || typeof b.user_id !== 'string') {
    errors.push({ field: 'user_id', message: 'user_id is required' });
  }
  if (!b.concert_id || typeof b.concert_id !== 'string') {
    errors.push({ field: 'concert_id', message: 'concert_id is required' });
  }
  if (!b.hold_expires_at || typeof b.hold_expires_at !== 'string') {
    errors.push({ field: 'hold_expires_at', message: 'hold_expires_at is required and must be an ISO datetime string' });
  } else if (isNaN(Date.parse(b.hold_expires_at))) {
    errors.push({ field: 'hold_expires_at', message: 'hold_expires_at must be a valid ISO datetime' });
  } else if (new Date(b.hold_expires_at) <= new Date()) {
    errors.push({ field: 'hold_expires_at', message: 'hold_expires_at must be in the future' });
  }

  if (!Array.isArray(b.items) || b.items.length === 0) {
    errors.push({ field: 'items', message: 'items must be a non-empty array' });
  } else {
    (b.items as unknown[]).forEach((item, i) => {
      const it = item as Record<string, unknown>;
      if (!it.ticket_type_id || typeof it.ticket_type_id !== 'string') {
        errors.push({ field: `items[${i}].ticket_type_id`, message: 'ticket_type_id is required' });
      }
      if (typeof it.quantity !== 'number' || !Number.isInteger(it.quantity) || it.quantity <= 0) {
        errors.push({ field: `items[${i}].quantity`, message: 'quantity must be a positive integer' });
      }
    });
  }

  if (errors.length > 0) return { errors };
  return { value: b as unknown as HoldRequest, errors: [] };
}

export function validateReleaseRequest(body: unknown): ValidationResult<ReleaseRequest> {
  const errors: ValidationError[] = [];
  const b = body as Record<string, unknown>;

  if (!b.order_id || typeof b.order_id !== 'string') {
    errors.push({ field: 'order_id', message: 'order_id is required' });
  }
  if (!b.reason || typeof b.reason !== 'string') {
    errors.push({ field: 'reason', message: 'reason is required' });
  }

  if (errors.length > 0) return { errors };
  return { value: b as unknown as ReleaseRequest, errors: [] };
}

export function validatePaymentConfirmationRequest(body: unknown): ValidationResult<PaymentConfirmationRequest> {
  const errors: ValidationError[] = [];
  const b = body as Record<string, unknown>;

  if (!b.order_id || typeof b.order_id !== 'string') {
    errors.push({ field: 'order_id', message: 'order_id is required' });
  }
  if (!b.payment_id || typeof b.payment_id !== 'string') {
    errors.push({ field: 'payment_id', message: 'payment_id is required' });
  }

  if (errors.length > 0) return { errors };
  return { value: b as unknown as PaymentConfirmationRequest, errors: [] };
}

export function validateInventoryAdjustmentRequest(body: unknown): ValidationResult<InventoryAdjustmentRequest> {
  const errors: ValidationError[] = [];
  const b = body as Record<string, unknown>;

  if (
    typeof b.delta_total_quantity !== 'number' ||
    !Number.isInteger(b.delta_total_quantity) ||
    b.delta_total_quantity === 0
  ) {
    errors.push({ field: 'delta_total_quantity', message: 'delta_total_quantity must be a non-zero integer' });
  }
  if (!b.reason || typeof b.reason !== 'string' || b.reason.trim() === '') {
    errors.push({ field: 'reason', message: 'reason is required' });
  }

  if (errors.length > 0) return { errors };
  return { value: b as unknown as InventoryAdjustmentRequest, errors: [] };
}
