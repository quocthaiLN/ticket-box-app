import type { NextFunction, Response } from "express";
import {
  cacheGet as get,
  getIdempotencyResponse,
  cacheSet as set,
  setIdempotencyResponse,
} from "@ticketbox/redis";
import type { AppRequest } from "../ticket.type.js";
import { Errors } from "../../../shared/http/problem-details.js";

const IDEMPOTENCY_TTL = 86400; // 24 hours

export async function idempotencyMiddleware(
  req: AppRequest,
  res: Response,
  next: NextFunction,
) {
  const rawKey = req.headers["idempotency-key"] as string | undefined;

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
  const scopedKey = `tickets:${userId}:${key}`;

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
