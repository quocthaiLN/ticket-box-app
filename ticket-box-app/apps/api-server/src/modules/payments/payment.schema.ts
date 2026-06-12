import { z } from 'zod';

export const retryPaymentSchema = z
  .object({
    payment_provider: z
      .enum(['VNPAY', 'MOMO'], {
        errorMap: () => ({ message: 'payment_provider must be VNPAY or MOMO' }),
      })
      .optional(),
  })
  // body is optional on the retry endpoint — treat a missing body as {}
  .default({});
