import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import type { AuthPayload, Role } from "./auth.type.js";

const BCRYPT_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRES_IN = "15m";
const REFRESH_TOKEN_EXPIRES_IN = "7d";
export const ACCESS_TOKEN_TTL_SECONDS = 900; // 15 min

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET env variable is not set");
  return secret;
}

function getRefreshSecret(): string {
  const secret = process.env.JWT_REFRESH_SECRET ?? process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET env variable is not set");
  return secret;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function signAccessToken(payload: { sub: string; role: Role }): string {
  return jwt.sign(
    { sub: payload.sub, role: payload.role, jti: randomUUID() },
    getJwtSecret(),
    { expiresIn: ACCESS_TOKEN_EXPIRES_IN }
  );
}

export function signRefreshToken(payload: { sub: string }): string {
  return jwt.sign(
    { sub: payload.sub, jti: randomUUID() },
    getRefreshSecret(),
    { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
  );
}

export function verifyToken(token: string): AuthPayload {
  try {
    return jwt.verify(token, getJwtSecret()) as AuthPayload;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      const e = Object.assign(new Error("Token expired"), { code: "TOKEN_EXPIRED" });
      throw e;
    }
    const e = Object.assign(new Error("Invalid token"), { code: "UNAUTHORIZED" });
    throw e;
  }
}

export function verifyRefreshToken(token: string): { sub: string; jti: string } {
  try {
    return jwt.verify(token, getRefreshSecret()) as { sub: string; jti: string };
  } catch {
    const e = Object.assign(new Error("Invalid refresh token"), { code: "UNAUTHORIZED" });
    throw e;
  }
}

/** Giây còn lại của token (dùng cho Redis TTL khi denylist). */
export function getTokenRemainingTtl(exp: number): number {
  return Math.max(0, exp - Math.floor(Date.now() / 1000));
}
