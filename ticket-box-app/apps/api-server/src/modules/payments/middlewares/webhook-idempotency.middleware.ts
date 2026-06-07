import type { NextFunction, Request, Response } from "express";
import {
  getIdempotencyResponse,
  setIdempotencyResponse,
} from "@ticketbox/redis";

export async function webhookIdempotencyMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  let provider: "VNPAY" | "MOMO" | null = null;
  let txnId: string | null = null;

  // Xác định nhà mạng thanh toán và mã giao dịch duy nhất
  if (req.path.includes("/vnpay")) {
    provider = "VNPAY";
    // VNPAY IPN có thể truyền qua query string (GET) hoặc body (POST)
    const payload = Object.keys(req.query).length > 0 ? req.query : req.body;
    txnId = (payload.vnp_TransactionNo as string) || null;
  } else if (req.path.includes("/momo")) {
    provider = "MOMO";
    txnId = (req.body.transId?.toString()) || null;
  }

  if (!provider || !txnId) {
    next();
    return;
  }

  const scopedKey = `webhook:${provider}:${txnId}`;

  try {
    const cached = await getIdempotencyResponse(scopedKey);
    if (cached) {
      res.status(cached.status).json(cached.body);
      return;
    }

    const originalJson = res.json.bind(res);
    res.json = (body: unknown): Response => {
      let shouldCache = false;
      
      if (res.statusCode < 400 && body && typeof body === "object") {
        if (provider === "VNPAY" && (body as Record<string, unknown>).RspCode === "00") {
          shouldCache = true;
        } else if (provider === "MOMO" && res.statusCode === 200 && (body as Record<string, unknown>).message === "success") {
          shouldCache = true;
        }
      }

      if (shouldCache) {
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
