import { z } from "zod";

export const InternalEnqueueSchema = z.object({
  type: z
    .enum([
      "SYSTEM",
      "ORDER_CONFIRMED",
      "PAYMENT_FAILED",
      "TICKET_ISSUED",
      "CONCERT_UPDATED",
      "CONCERT_REMINDER",
      "CHECKIN_ALERT",
      "ARTIST_BIO_READY",
    ])
    .optional(),
  channel: z.enum(["EMAIL", "APP", "SMS", "ZALO"]),
  user_id: z.string().uuid().optional(),
  concert_id: z.string().uuid().optional(),
  ticket_id: z.string().uuid().optional(),
  payload: z.record(z.unknown()).optional(),
  subject: z.string().optional(),
  body: z.string().optional(),
});

export const AdminNotificationsQuerySchema = z.object({
  concert_id: z.string().uuid().optional(),
  ticket_id: z.string().uuid().optional(),
  channel: z.enum(["EMAIL", "APP", "SMS", "ZALO"]).optional(),
  status: z.enum(["PENDING", "SENT", "FAILED"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

export type InternalEnqueueInput = z.infer<typeof InternalEnqueueSchema>;
export type AdminNotificationsQueryInput = z.infer<
  typeof AdminNotificationsQuerySchema
>;
