import { z } from "zod";

export const AuditListQuerySchema = z
  .object({
    actor_user_id: z.string().uuid().optional(),
    action: z.string().trim().min(1).max(100).optional(),
    entity_type: z.string().trim().min(1).max(100).optional(),
    entity_id: z.string().trim().min(1).max(100).optional(),
    from: z.string().datetime({ offset: true }).optional(),
    to: z.string().datetime({ offset: true }).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursor: z.string().trim().min(1).optional(),
  })
  .refine(
    (value) => {
      if (!value.from || !value.to) return true;
      return Date.parse(value.from) <= Date.parse(value.to);
    },
    {
      path: ["to"],
      message: "to must be later than or equal to from.",
    },
  );

export type AuditListQueryInput = z.infer<typeof AuditListQuerySchema>;
