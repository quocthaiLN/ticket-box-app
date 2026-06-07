import { ApiError } from "../../shared/http/problem-details.js";
import { authRepository } from "./auth.repository.js";
import type {
  AuthUser,
  LoginInput,
  RegisterInput,
  Role,
  TokenPair,
} from "./auth.type.js";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  getTokenRemainingTtl,
  hashPassword,
  signAccessToken,
  signRefreshToken,
  verifyPassword,
  verifyRefreshToken,
  verifyToken,
} from "./auth.utils.js";
import { addToDenylist, isTokenRevoked } from "@ticketbox/redis";

function toAuthUser(user: {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: string;
  status: string;
}): AuthUser {
  return {
    id: user.id,
    email: user.email,
    full_name: user.fullName,
    phone: user.phone,
    role: user.role as Role,
    status: user.status as AuthUser["status"],
  };
}

export const authService = {
  async register(input: RegisterInput): Promise<AuthUser> {
    const existing = await authRepository.findByEmail(input.email);
    if (existing) {
      throw new ApiError({
        title: "Email already exists",
        status: 409,
        code: "EMAIL_ALREADY_EXISTS",
        detail: "An account with this email already exists.",
      });
    }

    const passwordHash = await hashPassword(input.password);
    const user = await authRepository.createUser({
      email: input.email,
      passwordHash,
      fullName: input.full_name,
    });

    return toAuthUser(user);
  },

  async login(
    input: LoginInput,
  ): Promise<{ user: AuthUser; tokens: TokenPair }> {
    const user = await authRepository.findByEmail(input.email);

    // Không tiết lộ email có tồn tại hay không
    if (!user) {
      throw new ApiError({
        title: "Invalid credentials",
        status: 401,
        code: "INVALID_CREDENTIALS",
        detail: "Email or password is incorrect.",
      });
    }

    if (user.status === "LOCKED" || user.status === "DISABLED") {
      throw new ApiError({
        title: "Account inactive",
        status: 403,
        code: "FORBIDDEN",
        detail: "Your account is not active. Please contact support.",
      });
    }

    const valid = await verifyPassword(input.password, user.passwordHash);
    if (!valid) {
      throw new ApiError({
        title: "Invalid credentials",
        status: 401,
        code: "INVALID_CREDENTIALS",
        detail: "Email or password is incorrect.",
      });
    }

    const accessToken = signAccessToken({
      sub: user.id,
      role: user.role as Role,
    });
    const refreshToken = signRefreshToken({ sub: user.id });

    return {
      user: toAuthUser(user),
      tokens: {
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: "Bearer",
        expires_in: ACCESS_TOKEN_TTL_SECONDS,
      },
    };
  },

  async logout(accessToken: string): Promise<void> {
    try {
      const payload = verifyToken(accessToken);
      const ttl = getTokenRemainingTtl(payload.exp);
      if (ttl > 0) {
        await addToDenylist(payload.jti, ttl);
      }
    } catch {
      // Token đã expire hoặc invalid — không cần denylist
    }
  },

  async me(userId: string): Promise<AuthUser> {
    const user = await authRepository.findById(userId);
    if (!user) {
      throw new ApiError({
        title: "User not found",
        status: 404,
        code: "NOT_FOUND",
        detail: "User not found.",
      });
    }
    return toAuthUser(user);
  },

  async refresh(
    refreshToken: string,
  ): Promise<{ access_token: string; expires_in: number }> {
    const payload = verifyRefreshToken(refreshToken);
    const user = await authRepository.findById(payload.sub);
    if (!user || user.status === "LOCKED" || user.status === "DISABLED") {
      throw new ApiError({
        title: "Unauthorized",
        status: 401,
        code: "UNAUTHORIZED",
        detail: "Invalid refresh token.",
      });
    }
    return {
      access_token: signAccessToken({ sub: user.id, role: user.role as Role }),
      expires_in: ACCESS_TOKEN_TTL_SECONDS,
    };
  },

  async updateUserRole(
    actorId: string,
    targetUserId: string,
    role: Role,
  ): Promise<AuthUser> {
    const target = await authRepository.findById(targetUserId);
    if (!target) {
      throw new ApiError({
        title: "User not found",
        status: 404,
        code: "NOT_FOUND",
        detail: `User ${targetUserId} not found.`,
      });
    }

    const updated = await authRepository.updateRole(targetUserId, role);
    await authRepository.createAuditLog({
      actorUserId: actorId,
      action: "UPDATE_USER_ROLE",
      entityType: "user",
      entityId: targetUserId,
      metadata: { from: target.role, to: role },
    });

    return toAuthUser(updated);
  },

  async updateUserStatus(
    actorId: string,
    targetUserId: string,
    status: "ACTIVE" | "LOCKED" | "DISABLED",
  ): Promise<AuthUser> {
    const target = await authRepository.findById(targetUserId);
    if (!target) {
      throw new ApiError({
        title: "User not found",
        status: 404,
        code: "NOT_FOUND",
        detail: `User ${targetUserId} not found.`,
      });
    }

    const updated = await authRepository.updateStatus(targetUserId, status);
    await authRepository.createAuditLog({
      actorUserId: actorId,
      action: "UPDATE_USER_STATUS",
      entityType: "user",
      entityId: targetUserId,
      metadata: { from: target.status, to: status },
    });

    return toAuthUser(updated);
  },

  async verifyAccessToken(
    token: string,
  ): Promise<{ userId: string; role: Role; jti: string }> {
    const payload = verifyToken(token);
    const revoked = await isTokenRevoked(payload.jti);
    if (revoked) {
      throw new ApiError({
        title: "Token revoked",
        status: 401,
        code: "TOKEN_REVOKED",
        detail: "This token has been revoked. Please log in again.",
      });
    }
    return { userId: payload.sub, role: payload.role, jti: payload.jti };
  },
};
