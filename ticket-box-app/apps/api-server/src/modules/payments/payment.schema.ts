import { z } from 'zod';

export const createPaymentSchema = z
  .object({
    payment_provider: z
      .enum(['VNPAY', 'MOMO'], {
        errorMap: () => ({ message: 'payment_provider must be VNPAY or MOMO' }),
      })
      .optional(),
  })
  // body is optional on the payment endpoint — treat a missing body as {}
  .default({});

// VNPAY browser return (GET) — passthrough để GIỮ NGUYÊN mọi field vnp_* vì chữ ký
// được ký trên toàn bộ field; chỉ khai báo các field handler trực tiếp dùng.
export const vnpayReturnQuerySchema = z
  .object({
    vnp_TxnRef: z.string().optional(),
    vnp_ResponseCode: z.string().optional(),
    vnp_SecureHash: z.string().optional(),
  })
  .passthrough();

// MoMo browser return (GET) — query là string nên ép kiểu số cho các field số
// (cũng là các field tham gia ký), giúp controller khỏi tự coerce thủ công.
export const momoReturnQuerySchema = z.object({
  partnerCode: z.string().optional(),
  orderId: z.string().optional(),
  requestId: z.string().optional(),
  amount: z.coerce.number().optional(),
  orderInfo: z.string().optional(),
  orderType: z.string().optional(),
  transId: z.coerce.number().optional(),
  resultCode: z.coerce.number().optional(),
  message: z.string().optional(),
  payType: z.string().optional(),
  responseTime: z.coerce.number().optional(),
  extraData: z.string().optional(),
  signature: z.string().optional(),
});
