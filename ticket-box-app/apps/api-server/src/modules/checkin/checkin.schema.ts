import { ApiError } from "../../shared/http/problem-details.js";
import type { CheckinPreloadQuery, CheckinScanRequest, OfflineBatchRequest, OfflineSyncRequest } from "./checkin.types.js";

export function parseCheckinScanBody(body: unknown): CheckinScanRequest {
  const value = asRecord(body);
  const request: CheckinScanRequest = {
    concert_id: requiredString(value.concert_id, "concert_id"),
    device_id: requiredString(value.device_id, "device_id"),
    gate_id: requiredString(value.gate_id, "gate_id"),
    ticket_code: optionalString(value.ticket_code),
    qr_payload_hash: optionalString(value.qr_payload_hash),
    scanned_at: optionalIsoString(value.scanned_at, "scanned_at"),
    staff_user_id: optionalString(value.staff_user_id)
  };

  if (!request.ticket_code && !request.qr_payload_hash) {
    throw validationError("ticket_code", "Either ticket_code or qr_payload_hash is required.");
  }

  return request;
}

export function parseCheckinPreloadQuery(query: Record<string, unknown>): CheckinPreloadQuery {
  return {
    concert_id: requiredString(query.concert_id, "concert_id"),
    gate_id: requiredString(query.gate_id, "gate_id"),
    device_id: requiredString(query.device_id, "device_id"),
    include_guests: query.include_guests === "true",
    limit: parseLimit(query.limit, 1000),
    cursor: optionalString(query.cursor)
  };
}

export function parseOfflineSyncBody(body: unknown, routeBatchId?: string): OfflineSyncRequest {
  const value = asRecord(body);
  const items = Array.isArray(value.items) ? value.items : undefined;

  if (!items || items.length === 0) {
    throw validationError("items", "items must contain at least one offline scan item.");
  }

  return {
    device_id: requiredString(value.device_id, "device_id"),
    staff_user_id: requiredString(value.staff_user_id, "staff_user_id"),
    batch_id: optionalString(routeBatchId) ?? optionalString(value.batch_id) ?? requiredString(value.batch_token, "batch_id"),
    items: items.map((item, index) => {
      const row = asRecord(item, `items.${index}`);
      const ticketCode = optionalString(row.ticket_code);
      const qrPayloadHash = optionalString(row.qr_payload_hash);

      if (!ticketCode && !qrPayloadHash) {
        throw validationError(`items.${index}.ticket_code`, "Either ticket_code or qr_payload_hash is required.");
      }

      return {
        client_item_id: requiredString(row.client_item_id, `items.${index}.client_item_id`),
        ticket_code: ticketCode,
        qr_payload_hash: qrPayloadHash,
        concert_id: requiredString(row.concert_id, `items.${index}.concert_id`),
        gate_id: requiredString(row.gate_id, `items.${index}.gate_id`),
        zone_id: optionalString(row.zone_id),
        scanned_at: requiredIsoString(row.scanned_at, `items.${index}.scanned_at`)
      };
    })
  };
}

export function parseOfflineBatchBody(body: unknown): OfflineBatchRequest {
  const value = asRecord(body);

  return {
    batch_id: optionalString(value.batch_id) ?? requiredString(value.batch_token, "batch_id"),
    concert_id: requiredString(value.concert_id, "concert_id"),
    device_id: requiredString(value.device_id, "device_id"),
    gate_id: requiredString(value.gate_id, "gate_id"),
    started_at: optionalIsoString(value.started_at, "started_at"),
    ended_at: optionalIsoString(value.ended_at, "ended_at")
  };
}

function parseLimit(value: unknown, defaultLimit: number) {
  const requestedLimit = Number(value ?? defaultLimit);
  return Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 5000) : defaultLimit;
}

function asRecord(value: unknown, field = "body"): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw validationError(field, `${field} must be an object.`);
  }

  return value as Record<string, unknown>;
}

function requiredString(value: unknown, field: string) {
  const parsed = optionalString(value);

  if (!parsed) {
    throw validationError(field, `${field} is required.`);
  }

  return parsed;
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function requiredIsoString(value: unknown, field: string) {
  return optionalIsoString(value, field) ?? requiredString(value, field);
}

function optionalIsoString(value: unknown, field: string) {
  const parsed = optionalString(value);

  if (!parsed) {
    return undefined;
  }

  if (Number.isNaN(Date.parse(parsed))) {
    throw validationError(field, `${field} must be an ISO-8601 timestamp.`);
  }

  return parsed;
}

function validationError(field: string, message: string): ApiError {
  return new ApiError({
    type: "https://api.ticketbox.vn/errors/validation-error",
    title: "Validation error",
    status: 422,
    code: "VALIDATION_ERROR",
    detail: message,
    errors: [{ field, message }]
  });
}
