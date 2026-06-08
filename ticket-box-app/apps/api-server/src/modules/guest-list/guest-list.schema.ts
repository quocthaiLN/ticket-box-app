import { ApiError } from "../../shared/http/problem-details.js";
import type {
  GuestImportRequest,
  GuestScanRequest,
  GuestSearchQuery,
} from "./guest-list.types.js";

export function parseGuestImportBody(body: unknown): GuestImportRequest {
  const value = asRecord(body);

  return {
    concert_id: requiredString(value.concert_id, "concert_id"),
    file_object_key: optionalString(value.file_object_key),
    file_url: optionalString(value.file_url),
    default_zone_id: optionalString(value.default_zone_id),
    dry_run: value.dry_run === true || value.dry_run === "true",
  };
}

export function parseGuestSearchQuery(
  query: Record<string, unknown>,
): GuestSearchQuery {
  const parsed: GuestSearchQuery = {
    concert_id: requiredString(query.concert_id, "concert_id"),
    q: optionalString(query.q),
    name: optionalString(query.name),
    phone: optionalString(query.phone),
    zone_id: optionalString(query.zone_id),
    gate_id: optionalString(query.gate_id),
    limit: parseLimit(query.limit, 20),
    cursor: optionalString(query.cursor),
  };

  return parsed;
}

export function parseGuestScanBody(body: unknown): GuestScanRequest {
  const value = asRecord(body);
  const request: GuestScanRequest = {
    concert_id: requiredString(value.concert_id, "concert_id"),
    device_id: requiredString(value.device_id, "device_id"),
    gate_id: requiredString(value.gate_id, "gate_id"),
    guest_id: optionalString(value.guest_id),
    phone: optionalString(value.phone),
    scanned_at: optionalIsoString(value.scanned_at, "scanned_at"),
    staff_user_id: optionalString(value.staff_user_id),
  };

  if (!request.guest_id && !request.phone) {
    throw validationError("guest_id", "Either guest_id or phone is required.");
  }

  return request;
}

function parseLimit(value: unknown, defaultLimit: number) {
  const requestedLimit = Number(value ?? defaultLimit);
  return Number.isFinite(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), 100)
    : defaultLimit;
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
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
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
    title: "Validation error",
    status: 422,
    code: "VALIDATION_ERROR",
    detail: message,
    errors: [{ field, message }],
  });
}
