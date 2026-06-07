import {
  cacheDelete as del,
  cacheGet as get,
  cacheSet as set,
} from "@ticketbox/redis";
import {
  adjustInventory,
  confirmPayment,
  getInventoryByTicketTypeId,
  holdInventory,
  releaseInventory,
} from "./inventory.repository.js";
import type {
  HoldRequest,
  HoldResponse,
  InventoryAdjustmentRequest,
  InventoryAdjustmentResponse,
  InventoryView,
  PaymentConfirmationRequest,
  PaymentConfirmationResponse,
  ReleaseRequest,
  ReleaseResponse,
} from "./inventory.type.js";

const INVENTORY_CACHE_TTL = 60; // seconds
const INVENTORY_CACHE_KEY = (ticketTypeId: string) =>
  `inventory:${ticketTypeId}`;

export async function getInventory(
  ticketTypeId: string,
): Promise<InventoryView> {
  const cached = await get(INVENTORY_CACHE_KEY(ticketTypeId));
  if (cached) return cached as InventoryView;

  const row = await getInventoryByTicketTypeId(ticketTypeId);
  const view: InventoryView = {
    ticket_type_id: row.id,
    concert_id: row.concertId,
    seat_zone_id: row.seatZoneId,
    total_quantity: row.totalQuantity,
    held_quantity: row.heldQuantity,
    sold_quantity: row.soldQuantity,
    available_quantity: row.totalQuantity - row.heldQuantity - row.soldQuantity,
    status: row.status,
    updated_at: row.updatedAt.toISOString(),
  };

  await set(INVENTORY_CACHE_KEY(ticketTypeId), view, INVENTORY_CACHE_TTL);
  return view;
}

export async function holdTickets(
  req: HoldRequest,
  idempotencyKey: string,
): Promise<HoldResponse> {
  const { order, itemResults } = await holdInventory(req, idempotencyKey);

  // Invalidate cache for all affected ticket types
  await Promise.allSettled(
    req.items.map((i) => del(INVENTORY_CACHE_KEY(i.ticket_type_id))),
  );

  return {
    order_id: order.id,
    status: order.status,
    hold_expires_at: order.holdExpiresAt!.toISOString(),
    items: itemResults.map((r) => ({
      ticket_type_id: r.ticket_type_id,
      quantity: r.quantity,
      available_quantity_after: r.available_quantity_after,
    })),
  };
}

export async function releaseTickets(
  req: ReleaseRequest,
): Promise<ReleaseResponse> {
  const result = await releaseInventory(req);

  await Promise.allSettled(
    result.releasedItems.map((i) => del(INVENTORY_CACHE_KEY(i.ticket_type_id))),
  );

  return {
    order_id: result.orderId,
    status: result.status,
    released_items: result.releasedItems,
  };
}

export async function confirmTicketPayment(
  req: PaymentConfirmationRequest,
): Promise<PaymentConfirmationResponse> {
  const result = await confirmPayment(req);
  return {
    order_id: result.orderId,
    status: result.status,
    confirmed_at: result.confirmedAt.toISOString(),
  };
}

export async function adjustTicketInventory(
  ticketTypeId: string,
  req: InventoryAdjustmentRequest,
  actorUserId?: string,
): Promise<InventoryAdjustmentResponse> {
  const result = await adjustInventory(ticketTypeId, req, actorUserId);

  await del(INVENTORY_CACHE_KEY(ticketTypeId));

  return {
    ticket_type_id: result.ticketTypeId,
    total_quantity: result.totalQuantity,
    available_quantity: result.availableQuantity,
    audit_log_id: result.auditLogId,
  };
}
