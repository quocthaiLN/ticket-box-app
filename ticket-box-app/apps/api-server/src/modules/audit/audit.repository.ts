import { Prisma, prisma } from "@ticketbox/database";
import type { AuditListQuery, AuditLog, AuditRecordInput } from "./audit.types.js";

type AuditLogRow = Prisma.AuditLogGetPayload<{
  include: {
    actor: {
      select: {
        id: true;
        email: true;
        fullName: true;
        role: true;
      };
    };
  };
}>;

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function toAuditLog(row: AuditLogRow): AuditLog {
  return {
    id: row.id,
    actor_user_id: row.actorUserId,
    actor: row.actor
      ? {
          id: row.actor.id,
          email: row.actor.email,
          full_name: row.actor.fullName,
          role: row.actor.role,
        }
      : null,
    action: row.action,
    entity_type: row.entityType,
    entity_id: row.entityId,
    metadata: toRecord(row.metadata),
    ip_address: row.ipAddress,
    user_agent: row.userAgent,
    created_at: row.createdAt,
  };
}

function parseCursor(cursor?: string): { createdAt: Date; id: string } | null {
  if (!cursor) return null;

  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf8");
    const sepIdx = decoded.lastIndexOf(":");
    if (sepIdx <= 0) return null;

    const createdAt = new Date(decoded.slice(0, sepIdx));
    const id = decoded.slice(sepIdx + 1);
    if (Number.isNaN(createdAt.getTime()) || !id) return null;

    return { createdAt, id };
  } catch {
    return null;
  }
}

function encodeCursor(row: AuditLogRow): string {
  return Buffer.from(`${row.createdAt.toISOString()}:${row.id}`).toString(
    "base64url",
  );
}

export const auditRepository = {
  async create(input: AuditRecordInput): Promise<AuditLog> {
    const row = await prisma.auditLog.create({
      data: {
        actorUserId: input.actor_user_id ?? null,
        action: input.action,
        entityType: input.entity_type,
        entityId: input.entity_id ?? null,
        metadata: input.metadata
          ? (input.metadata as Prisma.InputJsonObject)
          : undefined,
        ipAddress: input.ip_address ?? null,
        userAgent: input.user_agent ?? null,
      },
      include: {
        actor: {
          select: { id: true, email: true, fullName: true, role: true },
        },
      },
    });

    return toAuditLog(row);
  },

  async findAll(query: AuditListQuery): Promise<{
    items: AuditLog[];
    nextCursor: string | null;
  }> {
    const limit = Math.min(query.limit ?? 20, 100);
    const fetchLimit = limit + 1;
    const cursor = parseCursor(query.cursor);

    const where: Prisma.AuditLogWhereInput = {};
    if (query.actor_user_id) where.actorUserId = query.actor_user_id;
    if (query.action) where.action = query.action;
    if (query.entity_type) where.entityType = query.entity_type;
    if (query.entity_id) where.entityId = query.entity_id;
    if (query.from || query.to) {
      where.createdAt = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lte: new Date(query.to) } : {}),
      };
    }
    if (cursor) {
      where.OR = [
        { createdAt: { lt: cursor.createdAt } },
        { createdAt: cursor.createdAt, id: { lt: cursor.id } },
      ];
    }

    const rows = await prisma.auditLog.findMany({
      where,
      include: {
        actor: {
          select: { id: true, email: true, fullName: true, role: true },
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: fetchLimit,
    });

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor =
      hasMore && pageRows.length > 0
        ? encodeCursor(pageRows[pageRows.length - 1])
        : null;

    return {
      items: pageRows.map(toAuditLog),
      nextCursor,
    };
  },
};
