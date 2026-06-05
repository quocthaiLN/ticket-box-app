// check idempotency key in header and store it in redis with a TTL of 24 hours
import type { NextFunction, Response } from 'express';
import { get, set } from '@ticket-box/redis';
import type { AppRequest } from '../inventory.type.js';

const IDEMPOTENCY_TTL = 86400; // 24 hours
const IDEMPOTENCY_KEY_PREFIX = 'idempotency:';

export function idempotencyMiddleware(req: AppRequest, res: Response, next: NextFunction) {
  const key = req.headers['idempotency-key'] as string | undefined;

  if (!key) {
    const err = Object.assign(new Error('Idempotency-Key header is required'), {
      statusCode: 400,
      code: 'MISSING_IDEMPOTENCY_KEY',
    });
    return next(err);
  }

  if (typeof key !== 'string' || key.trim() === '' || key.length > 128) {
    const err = Object.assign(new Error('Idempotency-Key must be a non-empty string under 128 characters'), {
      statusCode: 400,
      code: 'INVALID_IDEMPOTENCY_KEY',
    });
    return next(err);
  }

  const redisKey = `${IDEMPOTENCY_KEY_PREFIX}${key}`;

  get(redisKey)
    .then((cached) => {
      if (cached) {
        const payload = cached as { status: number; body: unknown };
        return res.status(payload.status).json(payload.body);
      }

      // Patch res.json to cache the response after it's sent
      const originalJson = res.json.bind(res);
      res.json = (body: unknown) => {
        set(redisKey, { status: res.statusCode, body }, IDEMPOTENCY_TTL).catch(() => {
          // Redis failure after response is non-fatal
        });
        return originalJson(body);
      };

      next();
    })
    .catch(next);
}
