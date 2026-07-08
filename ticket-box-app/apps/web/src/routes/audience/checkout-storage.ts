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
  paymentIdempotencyKey?: string;
};

const pendingCheckoutKey = "ticketbox.pendingCheckout";
const heldCheckoutsKey = "ticketbox.heldCheckouts";

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

function parseCheckout(raw: string | null): PendingCheckout | null {
  if (!raw) return null;
  const checkout = JSON.parse(raw) as PendingCheckout;
  return checkout && Array.isArray(checkout.items) ? checkout : null;
}

export function readPendingCheckout() {
  try {
    const active = parseCheckout(sessionStorage.getItem(pendingCheckoutKey));
    if (active && active.expiresAt > Date.now()) return active;

    // If the active checkout was completed/cleared, keep the remaining held
    // orders reachable from /checkout instead of stranding them in storage.
    const held = readHeldCheckouts();
    return held.find((checkout) => checkout.expiresAt > Date.now()) ?? active ?? held[0] ?? null;
  } catch {
    return null;
  }
}

export function writePendingCheckout(input: PendingCheckout) {
  try {
    const previous = parseCheckout(sessionStorage.getItem(pendingCheckoutKey));
    if (previous?.orderId && previous.orderId !== input.orderId) {
      upsertHeldCheckout(previous);
    }
  } catch {
    // Replace malformed legacy storage with the valid checkout below.
  }
  sessionStorage.setItem(pendingCheckoutKey, JSON.stringify(input));
  if (input.orderId) upsertHeldCheckout(input);
}

export function readHeldCheckouts(): PendingCheckout[] {
  try {
    const raw = sessionStorage.getItem(heldCheckoutsKey);
    const parsed = raw ? (JSON.parse(raw) as PendingCheckout[]) : [];
    const values = Array.isArray(parsed)
      ? parsed.filter((checkout) => checkout && checkout.orderId && Array.isArray(checkout.items))
      : [];
    const active = parseCheckout(sessionStorage.getItem(pendingCheckoutKey));
    if (active?.orderId && !values.some((checkout) => checkout.orderId === active.orderId)) {
      values.unshift(active);
    }
    return values;
  } catch {
    return [];
  }
}

function upsertHeldCheckout(input: PendingCheckout) {
  if (!input.orderId) return;
  const held = readHeldCheckouts();
  const index = held.findIndex((checkout) => checkout.orderId === input.orderId);
  if (index >= 0) held[index] = input;
  else held.unshift(input);
  sessionStorage.setItem(heldCheckoutsKey, JSON.stringify(held));
}

export function clearPendingCheckout(orderId?: string) {
  const active = parseCheckout(sessionStorage.getItem(pendingCheckoutKey));
  if (!orderId || active?.orderId === orderId) {
    sessionStorage.removeItem(pendingCheckoutKey);
  }
  if (orderId) {
    const remaining = readHeldCheckouts().filter((checkout) => checkout.orderId !== orderId);
    sessionStorage.setItem(heldCheckoutsKey, JSON.stringify(remaining));
  }
}

export function remainingSeconds(expiresAt: number) {
  return Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
}

export function formatCountdown(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const secs = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${secs}`;
}
