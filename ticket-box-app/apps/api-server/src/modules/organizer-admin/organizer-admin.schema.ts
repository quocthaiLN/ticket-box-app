import { Errors } from "../../shared/http/problem-details.js";

export type AdminListQuery = {
  status?: string;
  concert_id?: string;
  limit: number;
  cursor?: string;
};

export type RejectInput = {
  review_note?: string;
};

/** Một dòng ticket type đã lưu trong `organizer_requests.ticket_types` (JSONB). */
export type StoredTicketType = {
  zone_code: string;
  zone_name: string;
  zone_capacity: number;
  name: string;
  price: { amount: number; currency: "VND" };
  total_quantity: number;
  max_per_user: number;
  sale_start_at: string;
  sale_end_at: string;
};

export function parseAdminListQuery(query: Record<string, unknown>): AdminListQuery {
  const requestedLimit = Number(query.limit ?? 20);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), 100)
    : 20;

  return {
    status: asOptionalString(query.status),
    concert_id: asOptionalString(query.concert_id),
    limit,
    cursor: asOptionalString(query.cursor),
  };
}

export function parseRejectBody(body: unknown): RejectInput {
  const value = body === undefined || body === null ? {} : asRecord(body);
  return { review_note: asOptionalString(value.review_note) };
}

export function assertApprovalStatus(status?: string) {
  if (!status) return;
  if (!["PENDING", "APPROVED", "REJECTED"].includes(status)) {
    throw Errors.badRequest("status must be one of PENDING, APPROVED, REJECTED.");
  }
}

/**
 * Đọc lại `ticket_types` từ JSON đã lưu. Dữ liệu đã được validate ở bước tạo
 * hồ sơ; ở đây chỉ defensive-parse để chắc chắn không vỡ khi approve.
 */
export function parseStoredTicketTypes(value: unknown): StoredTicketType[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw Errors.fieldValidationError(
      "ticket_types",
      "Stored ticket_types are missing or empty; cannot approve this request.",
    );
  }

  return value.map((item, index) => {
    const record = asRecord(item);
    const price = asRecord(record.price);
    return {
      zone_code: requiredString(record.zone_code, `ticket_types[${index}].zone_code`).toUpperCase(),
      zone_name: requiredString(record.zone_name, `ticket_types[${index}].zone_name`),
      zone_capacity: requiredPositiveInt(record.zone_capacity, `ticket_types[${index}].zone_capacity`),
      name: requiredString(record.name, `ticket_types[${index}].name`),
      price: {
        amount: requiredNonNegativeNumber(price.amount, `ticket_types[${index}].price.amount`),
        currency: "VND",
      },
      total_quantity: requiredPositiveInt(record.total_quantity, `ticket_types[${index}].total_quantity`),
      max_per_user: requiredPositiveInt(record.max_per_user, `ticket_types[${index}].max_per_user`),
      sale_start_at: requiredString(record.sale_start_at, `ticket_types[${index}].sale_start_at`),
      sale_end_at: requiredString(record.sale_end_at, `ticket_types[${index}].sale_end_at`),
    };
  });
}

function asOptionalString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw Errors.fieldValidationError("body", "Expected an object.");
  }
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, field: string) {
  const text = asOptionalString(value);
  if (!text) {
    throw Errors.fieldValidationError(field, `${field} is required.`);
  }
  return text;
}

function requiredPositiveInt(value: unknown, field: string) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) {
    throw Errors.fieldValidationError(field, `${field} must be a positive integer.`);
  }
  return number;
}

function requiredNonNegativeNumber(value: unknown, field: string) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw Errors.fieldValidationError(field, `${field} must be a non-negative number.`);
  }
  return number;
}
