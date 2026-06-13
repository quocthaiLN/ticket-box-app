export type PaymentProvider = 'VNPAY' | 'MOMO';

export interface CheckoutInput {
  orderId: string;
  amount: string;
  currency: string;
  orderInfo: string;
}

export interface CheckoutResult {
  payUrl: string;
  providerRef: string;
}

export interface StatusInput {
  orderId: string;
  /** Provider transaction date, format yyyyMMddHHmmss (required by VNPay QueryDR). */
  transactionDate: string;
}

export interface StatusResult {
  paid: boolean;
  raw: Record<string, unknown>;
}

/**
 * Adapter boundary to a payment provider. Methods that perform network I/O are
 * the ones wrapped by the circuit breaker + bulkhead in payment.service.
 * (VNPay.createCheckout is local URL-signing and never hits the network.)
 */
export interface PaymentGateway {
  readonly provider: PaymentProvider;
  createCheckout(input: CheckoutInput): Promise<CheckoutResult>;
  queryStatus(input: StatusInput): Promise<StatusResult>;
}
