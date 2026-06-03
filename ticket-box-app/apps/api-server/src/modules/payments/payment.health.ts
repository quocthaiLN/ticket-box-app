import type { Request, Response } from 'express';
import { vnpayCircuitBreaker, momoCircuitBreaker } from './circuit-breaker/payment.circuit-breaker.js';
import { vnpayBulkhead, momoBulkhead } from './bulkhead/payment.bulkhead.js';

export function paymentHealthHandler(_req: Request, res: Response): void {
  const vnpayCb = vnpayCircuitBreaker.getStatus();
  const momoCb = momoCircuitBreaker.getStatus();

  const vnpayUp = vnpayCb.state !== 'OPEN';
  const momoUp = momoCb.state !== 'OPEN';

  const status = vnpayUp || momoUp ? 200 : 503;

  res.status(status).json({
    status: status === 200 ? 'ok' : 'degraded',
    providers: {
      vnpay: {
        available: vnpayUp,
        circuitBreaker: vnpayCb,
        bulkhead: vnpayBulkhead.getStatus(),
      },
      momo: {
        available: momoUp,
        circuitBreaker: momoCb,
        bulkhead: momoBulkhead.getStatus(),
      },
    },
  });
}
