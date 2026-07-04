import { z } from 'zod';
import { ApiError } from '../../shared/http/problem-details.js';
import type { TicketListQuery } from './ticket.type.js';

// Query string trống ('') được coi như không truyền (undefined).
const emptyToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

const ticketListQuerySchema = z.object({
  concert_id: z.preprocess(
    emptyToUndefined,
    z.string().uuid('concert_id must be a valid UUID').optional(),
  ),
  status: z.preprocess(
    emptyToUndefined,
    z
      .enum(['ISSUED', 'CHECKED_IN', 'CANCELLED', 'REFUNDED'], {
        errorMap: () => ({
          message: 'status must be one of ISSUED, CHECKED_IN, CANCELLED, REFUNDED',
        }),
      })
      .optional(),
  ),
  limit: z.preprocess(
    emptyToUndefined,
    z.coerce
      .number({ invalid_type_error: 'limit must be a number' })
      .int('limit must be an integer')
      .min(1, 'limit must be between 1 and 100')
      .max(100, 'limit must be between 1 and 100')
      .optional(),
  ),
  cursor: z.preprocess(
    emptyToUndefined,
    z.string().uuid('cursor must be a valid UUID').optional(),
  ),
});

function throwValidation(error: z.ZodError): never {
  throw new ApiError({
    title: 'Invalid ticket request',
    status: 400,
    code: 'INVALID_TICKET_REQUEST',
    detail: 'Request failed validation.',
    errors: error.issues.map((issue) => ({
      field: issue.path.join('.') || '(root)',
      message: issue.message,
    })),
  });
}

export function parseTicketListQuery(query: unknown): TicketListQuery {
  const result = ticketListQuerySchema.safeParse(query);
  if (!result.success) throwValidation(result.error);
  return result.data;
}

export function parseUuidParam(value: unknown, field: string): string {
  const result = z.string().uuid(`${field} must be a valid UUID`).safeParse(value);
  if (!result.success) throwValidation(result.error);
  return result.data;
}
