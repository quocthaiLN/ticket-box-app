import type { NextFunction, Request, Response } from "express";
import { getRedisClient } from "@ticketbox/redis";
import { env } from "@ticketbox/config";
import { Errors } from "../http/problem-details.js";

export type TokenBucketOptions = {
  /** Tên nhận diện policy (dùng làm tiền tố Redis key) */
  name: string;
  /** Số request tối đa trong cửa sổ */
  limit: number;
  /** Độ dài cửa sổ tính bằng giây */
  windowSec: number;
  /**
   * Hàm lấy định danh để phân biệt người dùng.
   * Mặc định: user_id (nếu đã xác thực) hoặc IP.
   */
  keyFn?: (req: Request, res: Response) => string;
  /** Bỏ qua policy cho request nội bộ/load-test đã được xác minh. */
  skipFn?: (req: Request, res: Response) => boolean;
};

function normalizeIp(ip: string | undefined): string {
  return (ip ?? "").trim().replace(/^::ffff:/, "");
}

function isOrderRateLimitWhitelisted(req: Request): boolean {
  if (!env.order.rateLimitWhitelistEnabled) return false;

  // Chỉ tin địa chỉ của TCP peer. Không dùng X-Forwarded-For do client có thể
  // tự giả header này. Nếu API đứng sau proxy, whitelist phải được xử lý tại
  // proxy hoặc proxy phải chuyển tiếp tới một cổng load-test riêng được bảo vệ.
  const sourceIp = normalizeIp(req.socket.remoteAddress);
  return env.order.rateLimitWhitelist.some(
    (allowedIp) => normalizeIp(allowedIp) === sourceIp,
  );
}

/**
 * Tạo middleware rate-limit dùng thuật toán Fixed Window Counter trong Redis.
 *
 * - Nếu Redis không khả dụng: pass-through để không làm sập demo.
 * - Khi vượt ngưỡng: trả 429 với header Retry-After.
 */
export function rateLimit(opts: TokenBucketOptions) {
  const { name, limit, windowSec, keyFn, skipFn } = opts;

  const defaultKeyFn = (req: Request, res: Response): string => {
    const userId = res.locals.auth?.user_id as string | undefined;
    if (userId) return `user:${userId}`;
    const ip =
      (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ??
      req.socket.remoteAddress ??
      "unknown";
    return `ip:${ip}`;
  };

  const resolveKey = keyFn ?? defaultKeyFn;

  return async function rateLimitMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    if (skipFn?.(req, res)) {
      next();
      return;
    }

    const client = getRedisClient();

    if (!client) {
      // Redis unavailable — pass through to avoid blocking demo
      next();
      return;
    }

    const identifier = resolveKey(req, res);
    const redisKey = `rl:${name}:${identifier}`;

    try {
      const pipeline = client.pipeline();
      pipeline.incr(redisKey);
      pipeline.ttl(redisKey);
      const results = await pipeline.exec();

      if (!results) {
        next();
        return;
      }

      const count = results[0][1] as number;
      const ttl = results[1][1] as number;

      // Nếu key vừa được tạo (ttl = -1), đặt expiry
      if (ttl === -1) {
        await client.expire(redisKey, windowSec);
      }

      const remaining = Math.max(0, limit - count);
      const retryAfter = ttl > 0 ? ttl : windowSec;

      res.setHeader("X-RateLimit-Limit", limit);
      res.setHeader("X-RateLimit-Remaining", remaining);
      res.setHeader("X-RateLimit-Window", windowSec);

      if (count > limit) {
        res.setHeader("Retry-After", retryAfter);
        next(Errors.rateLimited(retryAfter));
        return;
      }

      next();
    } catch (err) {
      console.error(`[rate-limit:${name}] Redis error:`, err);
      // Fail open — không block request khi Redis lỗi
      next();
    }
  };
}

// ---------------------------------------------------------------------------
// Pre-configured policies
// ---------------------------------------------------------------------------

/** Giới hạn nghiêm: 10 req / 60s cho checkout/order — chống scalper */
export const orderRateLimit = rateLimit({
  name: "orders",
  limit: 10,
  windowSec: 60,
  skipFn: (req) => isOrderRateLimitWhitelisted(req),
});

/** Giới hạn webhook: 60 req / 60s per IP — chống webhook flood */
export const webhookRateLimit = rateLimit({
  name: "webhook",
  limit: 60,
  windowSec: 60,
  keyFn: (req) => {
    const ip =
      (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ??
      req.socket.remoteAddress ??
      "unknown";
    return `ip:${ip}`;
  },
});

/** Giới hạn public read: 200 req / 60s per IP — cho catalog */
export const publicReadRateLimit = rateLimit({
  name: "public-read",
  limit: 200,
  windowSec: 60,
  keyFn: (req) => {
    const ip =
      (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ??
      req.socket.remoteAddress ??
      "unknown";
    return `ip:${ip}`;
  },
});
