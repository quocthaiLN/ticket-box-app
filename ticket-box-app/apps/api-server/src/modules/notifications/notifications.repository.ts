import { PrismaClient, NotificationChannel, NotificationType, NotificationStatus } from "@prisma/client";
import type { CreateNotificationInput, Notification } from "./notifications.types.js";

const prisma = new PrismaClient();

function mapChannel(ch: string): NotificationChannel {
  const map: Record<string, NotificationChannel> = {
    EMAIL: NotificationChannel.EMAIL,
    PUSH: NotificationChannel.APP,
    IN_APP: NotificationChannel.APP,
    APP: NotificationChannel.APP,
    SMS: NotificationChannel.SMS,
  };
  return map[ch] ?? NotificationChannel.APP;
}

function toNotification(row: {
  id: string;
  userId: string | null;
  channel: NotificationChannel;
  type: NotificationType;
  status: NotificationStatus;
  payload: unknown;
  sentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): Notification {
  const payload = row.payload as Record<string, unknown>;
  return {
    id: row.id,
    user_id: row.userId ?? "",
    channel: row.channel as string as Notification["channel"],
    subject: (payload.subject as string) ?? null,
    body: (payload.body as string) ?? "",
    status: row.status as string as Notification["status"],
    sent_at: row.sentAt,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

export const notificationsRepository = {
  async create(input: CreateNotificationInput): Promise<Notification> {
    const row = await prisma.notification.create({
      data: {
        userId: input.user_id,
        channel: mapChannel(input.channel),
        type: NotificationType.SYSTEM,
        status: NotificationStatus.PENDING,
        payload: {
          subject: input.subject ?? null,
          body: input.body,
        },
      },
    });
    return toNotification(row);
  },

  async updateStatus(id: string, status: "SENT" | "FAILED", sentAt?: Date): Promise<void> {
    await prisma.notification.update({
      where: { id },
      data: {
        status: status as NotificationStatus,
        sentAt: sentAt ?? (status === "SENT" ? new Date() : undefined),
      },
    });
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
