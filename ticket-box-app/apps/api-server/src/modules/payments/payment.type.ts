import type { Request } from 'express';
import type { z } from 'zod';
import type { momoReturnQuerySchema, vnpayReturnQuerySchema } from './payment.schema.js';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

export interface CreatePaymentRequest {
  payment_provider?: 'VNPAY' | 'MOMO';
}

export interface CreatePaymentResponse {
  payment_id: string;
  provider: string;
  status: string;
  checkout_url: string;
  order_id: string;
  hold_expires_at: string;
}

export interface VnpayWebhookBody {
  vnp_TmnCode?: string;
  vnp_Amount?: string;
  vnp_BankCode?: string;
  vnp_BankTranNo?: string;
  vnp_CardType?: string;
  vnp_PayDate?: string;
  vnp_OrderInfo?: string;
  vnp_TransactionNo?: string;
  vnp_ResponseCode?: string;
  vnp_TransactionStatus?: string;
  vnp_TxnRef?: string;
  vnp_SecureHashType?: string;
  vnp_SecureHash?: string;
  [key: string]: string | undefined;
}

export interface MomoWebhookBody {
  partnerCode?: string;
  orderId?: string;
  requestId?: string;
  amount?: number;
  orderInfo?: string;
  orderType?: string;
  transId?: number;
  resultCode?: number;
  message?: string;
  payType?: string;
  responseTime?: number;
  extraData?: string;
  signature?: string;
}

// Query đã validate/ép kiểu của các route browser return (suy ra từ schema).
export type VnpayReturnQuery = z.infer<typeof vnpayReturnQuerySchema>;
export type MomoReturnQuery = z.infer<typeof momoReturnQuerySchema>;

export interface AppRequest extends Request {}
