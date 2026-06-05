import type { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

export interface RetryPaymentRequest {
  payment_provider?: 'VNPAY' | 'MOMO';
}

export interface RetryPaymentResponse {
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

export interface AppRequest extends Request {}
