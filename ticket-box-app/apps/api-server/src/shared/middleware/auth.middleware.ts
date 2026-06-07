import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../http/problem-details.js";
import { authService } from "../../modules/auth/auth.service.js";

/**
 * requireAuth — Xác thực JWT và gắn thông tin user vào res.locals.
 * Kiểm tra: Bearer token hợp lệ, chưa hết hạn, chưa bị denylist.
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    next(
      new ApiError({
        title: "Unauthorized",
        status: 401,
        code: "UNAUTHORIZED",
        detail: "Missing or malformed Authorization header.",
      }),
    );
    return;
  }

  const token = authHeader.slice(7);

  try {
    const { userId, role, jti } = await authService.verifyAccessToken(token);
    res.locals.auth = { user_id: userId, role, jti, token };
    next();
  } catch (err) {
    if (err instanceof ApiError) {
      next(err);
      return;
    }
    const code = (err as { code?: string }).code ?? "UNAUTHORIZED";
    next(
      new ApiError({
        title: code === "TOKEN_EXPIRED" ? "Token expired" : "Unauthorized",
        status: 401,
        code: code as string,
        detail: (err as Error).message,
      }),
    );
  }
}
