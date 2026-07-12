// Check idempotency key in header and replay/cache the response per scope.
import type { NextFunction, Request, Response } from "express";
import { createHash } from "node:crypto";
import {
  getIdempotencyResponse,
  setIdempotencyResponse,
  acquireIdempotencyClaim,
  releaseIdempotencyClaim,
} from "@ticketbox/redis";
import { Errors } from "../http/problem-details.js";

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)]),
    );
  }
  return value;
}

function requestFingerprint(req: Request): string {
  // Dùng path thực (bao gồm order_id) để cùng một key không thể replay response
  // của resource khác qua một route template giống nhau.
  const endpoint = `${req.method.toUpperCase()} ${req.baseUrl}${req.path}`;
  return createHash("sha256")
    .update(`${endpoint}\n${JSON.stringify(canonicalize(req.body ?? null))}`)
    .digest("hex");
}

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
    const fingerprint = requestFingerprint(req);

    // Nếu đã có Idempotency Key đã tồn tại -> reply cho user
    try {
      const cached = await getIdempotencyResponse(scopedKey);
      if (cached) {
        if (cached.fingerprint && cached.fingerprint !== fingerprint) {
          next(Errors.idempotencyKeyReused());
          return;
        }
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
            fingerprint,
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
