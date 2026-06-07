// check idempotency key in header and store it in redis with a TTL of 24 hours
import type { NextFunction, Response } from "express";
import {
  cacheGet as get,
  getIdempotencyResponse,
  cacheSet as set,
  setIdempotencyResponse,
} from "@ticketbox/redis";
import { Errors } from "../../../shared/http/problem-details.js";

const IDEMPOTENCY_TTL = 86400; // 24 hours
const IDEMPOTENCY_KEY_PREFIX = "idempotency:";

export async function idempotencyMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const rawKey = req.headers.get("idempotency-key");

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
  const scopedKey = `inventory:${userId}:${key}`;

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
}
