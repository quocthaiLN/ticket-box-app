import { z } from 'zod';

const orderItemSchema = z.object({
  ticket_type_id: z
    .string({
      required_error: 'ticket_type_id is required',
      invalid_type_error: 'ticket_type_id is required',
    })
    .refine((val) => val.trim().length > 0, 'ticket_type_id is required'),
  quantity: z
    .number({
      required_error: 'quantity must be a positive integer',
      invalid_type_error: 'quantity must be a positive integer',
    })
    .int('quantity must be a positive integer')
    .positive('quantity must be a positive integer'),
});

export const createOrderSchema = z.object({
  concert_id: z
    .string({
      required_error: 'concert_id is required',
      invalid_type_error: 'concert_id is required',
    })
    .refine((val) => val.trim().length > 0, 'concert_id is required'),
  items: z
    .array(orderItemSchema, {
      required_error: 'items must be a non-empty array',
      invalid_type_error: 'items must be a non-empty array',
    })
    .min(1, 'items must be a non-empty array'),
});
