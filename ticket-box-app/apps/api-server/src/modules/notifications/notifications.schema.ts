import { z } from "zod";

/** Schema tạo notification nội bộ (internal use — không expose public endpoint Sprint 1) */
export const CreateNotificationSchema = z.object({
  user_id: z.string().min(1, "user_id is required"),
  channel: z.enum(["EMAIL", "PUSH", "IN_APP"] as const),
  subject: z.string().optional(),
  body: z.string().min(1, "body is required"),
});

export type CreateNotificationInput = z.infer<typeof CreateNotificationSchema>;
