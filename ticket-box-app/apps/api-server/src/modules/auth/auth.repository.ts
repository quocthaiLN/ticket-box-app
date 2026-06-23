import { PrismaClient, Prisma, UserRole, UserStatus } from "@prisma/client";
import type { Role } from "./auth.type.js";

const prisma = new PrismaClient();

export const authRepository = {
  async createUser(data: {
    email: string;
    passwordHash: string;
    fullName: string;
  }) {
    return prisma.user.create({ data });
  },

  async findById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  },

  async findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  },

  async updateRole(userId: string, role: Role) {
    return prisma.user.update({
      where: { id: userId },
      data: { role: role as UserRole },
    });
  },

  async updateStatus(userId: string, status: "ACTIVE" | "LOCKED" | "DISABLED") {
    return prisma.user.update({
      where: { id: userId },
      data: { status: status as UserStatus },
    });
  },

  async updateProfile(
    userId: string,
    data: { fullName?: string; phone?: string },
  ) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.fullName !== undefined ? { fullName: data.fullName } : {}),
        ...(data.phone !== undefined ? { phone: data.phone } : {}),
      },
    });
  },

  async listUsers(params: { limit: number; cursor?: string }) {
    return prisma.user.findMany({
      take: params.limit + 1,
      cursor: params.cursor ? { id: params.cursor } : undefined,
      orderBy: { createdAt: "desc" },
    });
  },

  async createAuditLog(data: {
    actorUserId: string;
    action: string;
    entityType: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
  }) {
    return prisma.auditLog.create({
      data: {
        actorUserId: data.actorUserId,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        metadata: data.metadata
          ? (data.metadata as Prisma.InputJsonObject)
          : undefined,
      },
    });
  },
};
