import type { Request } from 'express';
import type { ReleaseReason } from './inventory.constants.js';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

export interface HoldItem {
  ticket_type_id: string;
  quantity: number;
}

export interface HoldRequest {
  user_id: string;
  concert_id: string;
  items: HoldItem[];
  hold_expires_at: string;
}

export interface ReleaseRequest {
  order_id: string;
  reason: ReleaseReason;
}

export interface PaymentConfirmationRequest {
  order_id: string;
  payment_id: string;
}

export interface InventoryAdjustmentRequest {
  delta_total_quantity: number;
  reason: string;
}

export interface InventoryView {
  ticket_type_id: string;
  concert_id: string;
  seat_zone_id: string;
  total_quantity: number;
  available_quantity: number;
  held_quantity: number;
  sold_quantity: number;
  status: string;
  updated_at: string;
}

export interface HoldResponseItem {
  ticket_type_id: string;
  quantity: number;
  available_quantity_after: number;
}

export interface HoldResponse {
  order_id: string;
  status: string;
  hold_expires_at: string;
  items: HoldResponseItem[];
}

export interface ReleaseResponseItem {
  ticket_type_id: string;
  quantity: number;
}

export interface ReleaseResponse {
  order_id: string;
  status: string;
  released_items: ReleaseResponseItem[];
}

export interface PaymentConfirmationResponse {
  order_id: string;
  status: string;
  confirmed_at: string;
}

export interface InventoryAdjustmentResponse {
  ticket_type_id: string;
  total_quantity: number;
  available_quantity: number;
  audit_log_id: string;
}

export interface AppRequest extends Request {}
