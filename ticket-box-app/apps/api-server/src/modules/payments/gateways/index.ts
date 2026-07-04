import { MomoGateway } from './momo.gateway.js';
import { VnpayGateway } from './vnpay.gateway.js';
import type { PaymentGateway, PaymentProvider } from './payment.gateway.js';

// Registry tập trung: mỗi provider có một adapter cùng interface PaymentGateway.
const gateways: Record<PaymentProvider, PaymentGateway> = {
  VNPAY: new VnpayGateway(),
  MOMO: new MomoGateway(),
};

// Chọn adapter phù hợp để payment service không phụ thuộc chi tiết provider.
export function getGateway(provider: PaymentProvider): PaymentGateway {
  return gateways[provider];
}

export type { PaymentGateway, PaymentProvider } from './payment.gateway.js';
