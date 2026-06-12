// Check idempotency key in header and replay/cache the response per scope.
import type { NextFunction, Request, Response } from "express";
import {
  getIdempotencyResponse,
  setIdempotencyResponse,
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
    const rawKey = req.headers["idempotency-key"];

    if (!rawKey) {
      next(Errors.missingIdempotencyKey());
      return;
    }

    const key = Array.isArray(rawKey) ? rawKey[0] : rawKey;

    if (!key || key.trim() === "" || key.length > 128) {
      next(
        Errors.badRequest(
          "Idempotency-Key must be a non-empty string under 128 characters.",
        ),
      );
      return;
    }

    const userId: string = res.locals.auth?.user_id ?? "anon";
    const scopedKey = `${scope}:${userId}:${key}`;

    try {
      const cached = await getIdempotencyResponse(scopedKey);
      if (cached) {
        res.status(cached.status).json(cached.body);
        return;
      }

      const originalJson = res.json.bind(res);
      res.json = (body: unknown): Response => {
        if (res.statusCode < 400) {
          setIdempotencyResponse(scopedKey, {
            status: res.statusCode,
            body,
            created_at: new Date().toISOString(),
          }).catch(() => {});
        }
        return originalJson(body);
      };

      next();
    } catch (err) {
      next(err);
    }
  };
}
