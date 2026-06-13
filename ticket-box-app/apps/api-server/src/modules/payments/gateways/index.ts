import { MomoGateway } from './momo.gateway.js';
import { VnpayGateway } from './vnpay.gateway.js';
import type { PaymentGateway, PaymentProvider } from './payment.gateway.js';

const gateways: Record<PaymentProvider, PaymentGateway> = {
  VNPAY: new VnpayGateway(),
  MOMO: new MomoGateway(),
};

export function getGateway(provider: PaymentProvider): PaymentGateway {
  return gateways[provider];
}

export type { PaymentGateway, PaymentProvider } from './payment.gateway.js';
