import { z } from 'zod';

const holdItemSchema = z.object({
  ticket_type_id: z
    .string({
      required_error: 'ticket_type_id is required',
      invalid_type_error: 'ticket_type_id is required',
    })
    .min(1, 'ticket_type_id is required'),
  quantity: z
    .number({
      required_error: 'quantity must be a positive integer',
      invalid_type_error: 'quantity must be a positive integer',
    })
    .int('quantity must be a positive integer')
    .positive('quantity must be a positive integer'),
});

export const holdSchema = z.object({
  user_id: z
    .string({
      required_error: 'user_id is required',
      invalid_type_error: 'user_id is required',
    })
    .min(1, 'user_id is required'),
  concert_id: z
    .string({
      required_error: 'concert_id is required',
      invalid_type_error: 'concert_id is required',
    })
    .min(1, 'concert_id is required'),
  hold_expires_at: z
    .string({
      required_error: 'hold_expires_at is required and must be an ISO datetime string',
      invalid_type_error: 'hold_expires_at is required and must be an ISO datetime string',
    })
    .superRefine((val, ctx) => {
      if (isNaN(Date.parse(val))) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'hold_expires_at must be a valid ISO datetime',
        });
        return;
      }
      if (new Date(val) <= new Date()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'hold_expires_at must be in the future',
        });
      }
    }),
  items: z
    .array(holdItemSchema, {
      required_error: 'items must be a non-empty array',
      invalid_type_error: 'items must be a non-empty array',
    })
    .min(1, 'items must be a non-empty array')
    .refine(
      (items) => new Set(items.map((i) => i.ticket_type_id)).size === items.length,
      'items must not contain duplicate ticket_type_id',
    ),
});

export const releaseSchema = z.object({
  order_id: z
    .string({
      required_error: 'order_id is required',
      invalid_type_error: 'order_id is required',
    })
    .min(1, 'order_id is required'),
  reason: z
    .string({
      required_error: 'reason is required',
      invalid_type_error: 'reason is required',
    })
    .min(1, 'reason is required'),
});

export const paymentConfirmationSchema = z.object({
  order_id: z
    .string({
      required_error: 'order_id is required',
      invalid_type_error: 'order_id is required',
    })
    .min(1, 'order_id is required'),
  payment_id: z
    .string({
      required_error: 'payment_id is required',
      invalid_type_error: 'payment_id is required',
    })
    .min(1, 'payment_id is required'),
});

export const inventoryAdjustmentSchema = z.object({
  delta_total_quantity: z
    .number({
      required_error: 'delta_total_quantity must be a non-zero integer',
      invalid_type_error: 'delta_total_quantity must be a non-zero integer',
    })
    .int('delta_total_quantity must be a non-zero integer')
    .refine((val) => val !== 0, 'delta_total_quantity must be a non-zero integer'),
  reason: z
    .string({
      required_error: 'reason is required',
      invalid_type_error: 'reason is required',
    })
    .refine((val) => val.trim().length > 0, 'reason is required'),
});
