// Check idempotency key in header and replay/cache the response per scope.
import type { NextFunction, Request, Response } from "express";
import {
  getIdempotencyResponse,
  setIdempotencyResponse,
  acquireIdempotencyClaim,
  releaseIdempotencyClaim,
} from "@ticketbox/redis";
import { Errors } from "../http/problem-details.js";

/**
 * Idempotency middleware factory. `scope` namespaces the Redis key per module
 * (e.g. "orders", "payments") so keys don't collide across endpoints.
 */
export function idempotencyMiddleware(scope: string) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {

    // Kiểm tra idempotency có tồn tại hay không
    const rawKey = req.headers["idempotency-key"];

    if (!rawKey) {
      next(Errors.missingIdempotencyKey());
      return;
    }

    // Idempotency phải <= 128 bit và không rỗng
    const key = Array.isArray(rawKey) ? rawKey[0] : rawKey;

    if (!key || key.trim() === "" || key.length > 128) {
      next(
        Errors.badRequest(
          "Idempotency-Key must be a non-empty string under 128 characters.",
        ),
      );
      return;
    }

    // Nếu user là khách thì đặt userId là anon
    const userId: string = res.locals.auth?.user_id ?? "anon";
    const scopedKey = `${scope}:${userId}:${key}`;

    // Nếu đã có Idempotency Key đã tồn tại -> reply cho user
    try {
      const cached = await getIdempotencyResponse(scopedKey);
      if (cached) {
        res.status(cached.status).json(cached.body);
        return;
      }

      const claimToken = await acquireIdempotencyClaim(scopedKey);
      if (claimToken === null) {
        next(Errors.idempotencyInProgress());
        return;
      }

      let claimReleased = false;
      const releaseClaim = (): void => {
        if (!claimToken || claimReleased) return;
        claimReleased = true;
        void releaseIdempotencyClaim(scopedKey, claimToken);
      };

      const originalJson = res.json.bind(res);
      res.json = (body: unknown): Response => {
        if (res.statusCode < 400) {
          setIdempotencyResponse(scopedKey, {
            status: res.statusCode,
            body,
            created_at: new Date().toISOString(),
          }).finally(releaseClaim);
        } else {
          releaseClaim();
        }
        return originalJson(body);
      };

      next();
    } catch (err) {
      next(err);
    }
  };
}
