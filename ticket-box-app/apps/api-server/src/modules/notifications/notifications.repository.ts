import { prisma, NotificationChannel, NotificationType, NotificationStatus } from "@ticketbox/database";
import type {
  AdminNotificationsQuery,
  CreateNotificationInput,
  Notification,
  UpdateStatusOptions,
} from "./notifications.types.js";

function mapChannel(ch: string): NotificationChannel {
  const map: Record<string, NotificationChannel> = {
    EMAIL: NotificationChannel.EMAIL,
    APP: NotificationChannel.APP,
    PUSH: NotificationChannel.APP,
    IN_APP: NotificationChannel.APP,
    SMS: NotificationChannel.SMS,
    ZALO: NotificationChannel.ZALO,
  };
  return map[ch] ?? NotificationChannel.APP;
}

function mapType(t?: string): NotificationType {
  if (!t) return NotificationType.SYSTEM;
  const valid = Object.values(NotificationType) as string[];
  return valid.includes(t) ? (t as NotificationType) : NotificationType.SYSTEM;
}

function toNotification(row: {
  id: string;
  userId: string | null;
  concertId: string | null;
  ticketId: string | null;
  channel: NotificationChannel;
  type: NotificationType;
  status: NotificationStatus;
  payload: unknown;
  attempts: number;
  errorMessage: string | null;
  sentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): Notification {
  const payload = (row.payload as Record<string, unknown>) ?? {};
  return {
    id: row.id,
    user_id: row.userId,
    concert_id: row.concertId,
    ticket_id: row.ticketId,
    channel: row.channel as Notification["channel"],
    type: row.type as Notification["type"],
    status: row.status as Notification["status"],
    payload,
    attempts: row.attempts,
    error_message: row.errorMessage,
    sent_at: row.sentAt,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

export const notificationsRepository = {
  async create(input: CreateNotificationInput): Promise<Notification> {
    const payload =
      input.payload ??
      (input.body !== undefined
        ? { subject: input.subject ?? null, body: input.body }
        : {});

    const row = await prisma.notification.create({
      data: {
        userId: input.user_id ?? null,
        concertId: input.concert_id ?? null,
        ticketId: input.ticket_id ?? null,
        channel: mapChannel(input.channel),
        type: mapType(input.type),
        status: NotificationStatus.PENDING,
        payload: payload as never,
      },
    });
    return toNotification(row);
  },

  async findById(id: string): Promise<Notification | null> {
    const row = await prisma.notification.findUnique({ where: { id } });
    if (!row) return null;
    return toNotification(row);
  },

  async findAll(query: AdminNotificationsQuery): Promise<{
    items: Notification[];
    nextCursor: string | null;
  }> {
    const limit = Math.min(query.limit ?? 20, 100);
    const fetchLimit = limit + 1;

    let cursorDate: Date | null = null;
    let cursorId: string | null = null;
    if (query.cursor) {
      try {
        const decoded = Buffer.from(query.cursor, "base64url").toString("utf8");
        const sepIdx = decoded.lastIndexOf(":");
        cursorDate = new Date(decoded.slice(0, sepIdx));
        cursorId = decoded.slice(sepIdx + 1);
      } catch {
        // ignore invalid cursor
      }
    }

    const where: Record<string, unknown> = {};
    if (query.concert_id) where.concertId = query.concert_id;
    if (query.ticket_id) where.ticketId = query.ticket_id;
    if (query.channel) where.channel = mapChannel(query.channel);
    if (query.status) where.status = query.status as NotificationStatus;
    if (cursorDate && cursorId) {
      where.OR = [
        { createdAt: { lt: cursorDate } },
        { createdAt: cursorDate, id: { lt: cursorId } },
      ];
    }

    const rows = await prisma.notification.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: fetchLimit,
    });

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    let nextCursor: string | null = null;
    if (hasMore && items.length > 0) {
      const last = items[items.length - 1];
      nextCursor = Buffer.from(
        `${last.createdAt.toISOString()}:${last.id}`,
      ).toString("base64url");
    }

    return { items: items.map(toNotification), nextCursor };
  },

  async updateStatus(
    id: string,
    status: "SENT" | "FAILED",
    opts: UpdateStatusOptions = {},
  ): Promise<void> {
    await prisma.notification.update({
      where: { id },
      data: {
        status: status as NotificationStatus,
        sentAt: opts.sentAt ?? (status === "SENT" ? new Date() : undefined),
        errorMessage: opts.errorMessage ?? null,
        attempts: { increment: 1 },
      },
    });
  },

  async resetToPending(id: string): Promise<Notification | null> {
    try {
      const row = await prisma.notification.update({
        where: { id, status: NotificationStatus.FAILED },
        data: {
          status: NotificationStatus.PENDING,
          errorMessage: null,
        },
      });
      return toNotification(row);
    } catch {
      return null;
    }
  },

  async findByUserId(userId: string): Promise<Notification[]> {
    const rows = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return rows.map(toNotification);
  },
};
