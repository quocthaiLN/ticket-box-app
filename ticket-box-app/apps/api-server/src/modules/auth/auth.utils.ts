/**
 * auth.utils.ts — Stub utilities cho password hashing và JWT.
 * Sprint 1: chỉ là placeholder interface. Sprint 2 sẽ implement bằng bcrypt + jsonwebtoken.
 */

import type { AuthPayload, Role } from "./auth.type.js";

// ---------------------------------------------------------------------------
// Password hashing stubs
// ---------------------------------------------------------------------------

/**
 * Hash mật khẩu plaintext (stub — Sprint 2 dùng bcrypt).
 */
export async function hashPassword(_plain: string): Promise<string> {
  throw new Error("hashPassword: not implemented — Sprint 2");
}

/**
 * Xác minh mật khẩu so với hash đã lưu (stub — Sprint 2 dùng bcrypt).
 */
export async function verifyPassword(
  _plain: string,
  _hash: string
): Promise<boolean> {
  throw new Error("verifyPassword: not implemented — Sprint 2");
}

// ---------------------------------------------------------------------------
// JWT stubs
// ---------------------------------------------------------------------------

/**
 * Ký access token ngắn hạn (stub — Sprint 2 dùng jsonwebtoken).
 * Payload chứa sub (user_id), role, jti, iat, exp.
 */
export function signAccessToken(_payload: {
  sub: string;
  role: Role;
}): string {
  throw new Error("signAccessToken: not implemented — Sprint 2");
}

/**
 * Ký refresh token dài hạn (stub — Sprint 2 dùng jsonwebtoken).
 */
export function signRefreshToken(_payload: { sub: string }): string {
  throw new Error("signRefreshToken: not implemented — Sprint 2");
}

/**
 * Xác minh và giải mã JWT (stub — Sprint 2 kiểm tra Redis denylist).
 */
export function verifyToken(_token: string): AuthPayload {
  throw new Error("verifyToken: not implemented — Sprint 2");
}
