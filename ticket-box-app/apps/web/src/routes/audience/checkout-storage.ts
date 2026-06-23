import { newIdempotencyKey, type PaymentProvider } from "../../services/order.service";

export type PendingCheckoutItem = {
  ticketTypeId: string;
  ticketTypeName: string;
  zoneName: string;
  zoneColor: string;
  quantity: number;
  unitPrice: number;
};

export type PendingCheckout = {
  concertId: string;
  concertTitle?: string;
  artistName?: string;
  coverImageUrl?: string;
  venueName?: string;
  startsAt?: string;
  expiresAt: number;
  idempotencyKey: string;
  paymentProvider: PaymentProvider;
  items: PendingCheckoutItem[];
  totalPrice: number;
  orderId?: string;
  checkoutUrl?: string;
};

const pendingCheckoutKey = "ticketbox.pendingCheckout";

export function createPendingCheckout(concertId: string): PendingCheckout {
  return {
    concertId,
    expiresAt: Date.now() + 10 * 60 * 1000,
    idempotencyKey: newIdempotencyKey(),
    paymentProvider: "VNPAY",
    items: [],
    totalPrice: 0,
  };
}

export function readPendingCheckout() {
  try {
    const raw = sessionStorage.getItem(pendingCheckoutKey);
    return raw ? (JSON.parse(raw) as PendingCheckout) : null;
  } catch {
    return null;
  }
}

export function writePendingCheckout(input: PendingCheckout) {
  sessionStorage.setItem(pendingCheckoutKey, JSON.stringify(input));
}

export function clearPendingCheckout() {
  sessionStorage.removeItem(pendingCheckoutKey);
}

export function remainingSeconds(expiresAt: number) {
  return Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
}

export function formatCountdown(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const secs = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${secs}`;
}
