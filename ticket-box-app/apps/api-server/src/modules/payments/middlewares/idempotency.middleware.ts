import type { NextFunction, Response } from 'express';
import { get, set } from '@ticket-box/redis';
import type { AppRequest } from '../payment.type.js';

const IDEMPOTENCY_TTL = 86400; // 24 hours

export function idempotencyMiddleware(req: AppRequest, res: Response, next: NextFunction) {
  const key = req.headers['idempotency-key'] as string | undefined;
  const userId = req.headers['x-user-id'] as string | undefined;

  if (!key) {
    const err = Object.assign(new Error('Idempotency-Key header is required'), {
      statusCode: 400,
      code: 'MISSING_IDEMPOTENCY_KEY',
    });
    return next(err);
  }

  if (key.trim() === '' || key.length > 128) {
    const err = Object.assign(new Error('Idempotency-Key must be a non-empty string under 128 characters'), {
      statusCode: 400,
      code: 'INVALID_IDEMPOTENCY_KEY',
    });
    return next(err);
  }

  const redisKey = `idempotency:payment:${userId ?? 'anon'}:${key}`;

  get(redisKey)
    .then((cached) => {
      if (cached) {
        const payload = cached as { statusCode: number; body: unknown };
        return res.status(payload.statusCode).json(payload.body);
      }

      const originalJson = res.json.bind(res);
      res.json = (body: unknown) => {
        if (res.statusCode < 400) {
          set(redisKey, { statusCode: res.statusCode, body }, IDEMPOTENCY_TTL).catch(() => {});
        }
        return originalJson(body);
      };

      next();
    })
    .catch(next);
}
