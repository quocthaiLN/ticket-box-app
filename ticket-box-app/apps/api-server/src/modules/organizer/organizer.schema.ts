import { Errors } from "../../shared/http/problem-details.js";
import { extractDriveFolderId } from "../../shared/utils/drive.js";

export type ApprovalStatusValue = "PENDING" | "APPROVED" | "REJECTED";
export type ConcertStatusValue = "DRAFT" | "PUBLISHED" | "CANCELLED" | "COMPLETED";
export type OrderStatusValue = "HELD" | "CONFIRMED" | "CANCELLED" | "EXPIRED";
export type GuestStatusValue = "INVITED" | "CHECKED_IN" | "CANCELLED";

export type ListQuery = {
  q?: string;
  city?: string;
  status?: string;
  concert_id?: string;
  seat_zone_id?: string;
  limit: number;
  cursor?: string;
};

export type OrganizerRequestTicketTypeInput = {
  zone_code: string;
  zone_name: string;
  zone_capacity: number;
  name: string;
  price: {
    amount: number;
    currency: "VND";
  };
  total_quantity: number;
  max_per_user: number;
  sale_start_at: string;
  sale_end_at: string;
};

export type CreateOrganizerTicketTypeInput = {
  seat_zone_id: string;
  name: string;
  description?: string;
  price: {
    amount: number;
    currency: "VND";
  };
  total_quantity: number;
  max_per_user: number;
  sale_start_at: string;
  sale_end_at: string;
};

export type CreateOrganizerSeatZoneInput = {
  code: string;
  name: string;
  description?: string;
  capacity: number;
  svg_path?: string;
  sort_order: number;
};

export type CreateOrganizerRequestInput = {
  venue_id: string;
  title: string;
  artist_name: string;
  description?: string;
  starts_at: string;
  ends_at: string;
  planned_publish_at?: string;
  gate_count: number;
  checker_count: number;
  press_kit_url?: string;
  ticket_types: OrganizerRequestTicketTypeInput[];
};

export type UpdateOrganizerConcertInput = {
  venue_id?: string;
  title?: string;
  description?: string;
  artist_name?: string;
  artist_bio?: string;
  starts_at?: string;
  ends_at?: string;
  planned_publish_at?: string;
  cover_image_url?: string;
  seat_map_url?: string;
  guest_drive_folder_id?: string;
};

export type CreateDeletionRequestInput = {
  reason?: string;
};

export function parseListQuery(query: Record<string, unknown>): ListQuery {
  const requestedLimit = Number(query.limit ?? 20);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), 100)
    : 20;

  return {
    q: asOptionalString(query.q),
    city: asOptionalString(query.city),
    status: asOptionalString(query.status),
    concert_id: asOptionalString(query.concert_id),
    seat_zone_id: asOptionalString(query.seat_zone_id),
    limit,
    cursor: asOptionalString(query.cursor),
  };
}

export function parseCreateOrganizerRequestBody(body: unknown): CreateOrganizerRequestInput {
  const value = asRecord(body);
  const ticketTypes = parseTicketTypes(value.ticket_types);

  return {
    venue_id: requiredString(value.venue_id, "venue_id"),
    title: requiredString(value.title, "title"),
    artist_name: requiredString(value.artist_name, "artist_name"),
    description: asOptionalString(value.description),
    starts_at: requiredDateString(value.starts_at, "starts_at"),
    ends_at: requiredDateString(value.ends_at, "ends_at"),
    planned_publish_at: optionalDateString(value.planned_publish_at, "planned_publish_at"),
    gate_count: requiredPositiveInt(value.gate_count, "gate_count"),
    checker_count: requiredPositiveInt(value.checker_count, "checker_count"),
    press_kit_url: asOptionalString(value.press_kit_url),
    ticket_types: ticketTypes,
  };
}

export function parseCreateOrganizerTicketTypeBody(body: unknown): CreateOrganizerTicketTypeInput {
  const value = asRecord(body);
  const saleStartAt = requiredDateString(value.sale_start_at, "sale_start_at");
  const saleEndAt = requiredDateString(value.sale_end_at, "sale_end_at");

  if (new Date(saleEndAt) <= new Date(saleStartAt)) {
    throw validationError("sale_end_at", "sale_end_at must be later than sale_start_at.");
  }

  return {
    seat_zone_id: requiredString(value.seat_zone_id, "seat_zone_id"),
    name: requiredString(value.name, "name"),
    description: asOptionalString(value.description),
    price: parseTicketTypeMoney(value.price),
    total_quantity: requiredPositiveInt(value.total_quantity, "total_quantity"),
    max_per_user: requiredPositiveInt(value.max_per_user, "max_per_user"),
    sale_start_at: saleStartAt,
    sale_end_at: saleEndAt,
  };
}

export function parseCreateOrganizerSeatZoneBody(body: unknown): CreateOrganizerSeatZoneInput {
  const value = asRecord(body);

  return {
    code: requiredString(value.code, "code").toUpperCase(),
    name: requiredString(value.name, "name"),
    description: asOptionalString(value.description),
    capacity: requiredPositiveInt(value.capacity, "capacity"),
    svg_path: asOptionalString(value.svg_path),
    sort_order: optionalInt(value.sort_order, "sort_order") ?? 0,
  };
}

export function parseUpdateOrganizerConcertBody(body: unknown): UpdateOrganizerConcertInput {
  const value = asRecord(body);

  return stripUndefined({
    venue_id: asOptionalString(value.venue_id),
    title: asOptionalString(value.title),
    description: asOptionalString(value.description),
    artist_name: asOptionalString(value.artist_name),
    artist_bio: asOptionalString(value.artist_bio),
    starts_at: optionalDateString(value.starts_at, "starts_at"),
    ends_at: optionalDateString(value.ends_at, "ends_at"),
    planned_publish_at: optionalDateString(value.planned_publish_at, "planned_publish_at"),
    cover_image_url: asOptionalString(value.cover_image_url),
    seat_map_url: asOptionalString(value.seat_map_url),
    guest_drive_folder_id: parseGuestDriveFolderId(value.guest_drive_folder_id),
  });
}

export function parseCreateDeletionRequestBody(body: unknown): CreateDeletionRequestInput {
  const value = body === undefined ? {} : asRecord(body);
  return {
    reason: asOptionalString(value.reason),
  };
}

function parseTicketTypes(value: unknown): OrganizerRequestTicketTypeInput[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw validationError("ticket_types", "ticket_types must contain at least one item.");
  }

  const ticketTypes = value.map((item, index) => {
    const record = asRecord(item);
    const saleStartAt = requiredDateString(record.sale_start_at, `ticket_types[${index}].sale_start_at`);
    const saleEndAt = requiredDateString(record.sale_end_at, `ticket_types[${index}].sale_end_at`);

    if (new Date(saleEndAt) <= new Date(saleStartAt)) {
      throw validationError(`ticket_types[${index}].sale_end_at`, "sale_end_at must be later than sale_start_at.");
    }

    return {
      zone_code: requiredString(record.zone_code, `ticket_types[${index}].zone_code`).toUpperCase(),
      zone_name: requiredString(record.zone_name, `ticket_types[${index}].zone_name`),
      zone_capacity: requiredPositiveInt(record.zone_capacity, `ticket_types[${index}].zone_capacity`),
      name: requiredString(record.name, `ticket_types[${index}].name`),
      price: parseMoney(record.price, index),
      total_quantity: requiredPositiveInt(record.total_quantity, `ticket_types[${index}].total_quantity`),
      max_per_user: requiredPositiveInt(record.max_per_user, `ticket_types[${index}].max_per_user`),
      sale_start_at: saleStartAt,
      sale_end_at: saleEndAt,
    };
  });

  assertZoneCapacity(ticketTypes);
  return ticketTypes;
}

function parseMoney(value: unknown, index: number) {
  const money = asRecord(value);
  const amount = Number(money.amount);
  if (!Number.isFinite(amount) || amount < 0) {
    throw validationError(`ticket_types[${index}].price.amount`, "price.amount must be a non-negative number.");
  }

  if (money.currency !== undefined && money.currency !== "VND") {
    throw validationError(`ticket_types[${index}].price.currency`, "Only VND is supported.");
  }

  return { amount, currency: "VND" as const };
}

function parseTicketTypeMoney(value: unknown) {
  const money = asRecord(value);
  const amount = Number(money.amount);
  if (!Number.isFinite(amount) || amount < 0) {
    throw validationError("price.amount", "price.amount must be a non-negative number.");
  }

  if (money.currency !== undefined && money.currency !== "VND") {
    throw validationError("price.currency", "Only VND is supported.");
  }

  return { amount, currency: "VND" as const };
}

function assertZoneCapacity(ticketTypes: OrganizerRequestTicketTypeInput[]) {
  const zoneTotals = new Map<string, { capacity: number; total: number }>();

  for (const ticketType of ticketTypes) {
    const current = zoneTotals.get(ticketType.zone_code) ?? {
      capacity: ticketType.zone_capacity,
      total: 0,
    };
    current.capacity = Math.min(current.capacity, ticketType.zone_capacity);
    current.total += ticketType.total_quantity;
    zoneTotals.set(ticketType.zone_code, current);
  }

  for (const [zoneCode, item] of zoneTotals) {
    if (item.total > item.capacity) {
      throw validationError(
        "ticket_types",
        `Total quantity for zone ${zoneCode} exceeds zone_capacity.`,
      );
    }
  }
}

function asOptionalString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function parseGuestDriveFolderId(value: unknown): string | undefined {
  const raw = asOptionalString(value);
  if (raw === undefined) return undefined;

  const folderId = extractDriveFolderId(raw);
  if (!folderId) {
    throw validationError(
      "guest_drive_folder_id",
      "guest_drive_folder_id must be a Google Drive folder link or folder ID.",
    );
  }
  return folderId;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw validationError("body", "Request body must be an object.");
  }

  return value as Record<string, unknown>;
}

function requiredString(value: unknown, field: string) {
  const text = asOptionalString(value);
  if (!text) {
    throw validationError(field, `${field} is required.`);
  }
  return text;
}

function requiredDateString(value: unknown, field: string) {
  const text = requiredString(value, field);
  if (Number.isNaN(Date.parse(text))) {
    throw validationError(field, `${field} must be a valid datetime.`);
  }
  return text;
}

function optionalDateString(value: unknown, field: string) {
  if (value === undefined || value === null || value === "") return undefined;
  return requiredDateString(value, field);
}

function requiredPositiveInt(value: unknown, field: string) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) {
    throw validationError(field, `${field} must be a positive integer.`);
  }
  return number;
}

function optionalInt(value: unknown, field: string) {
  if (value === undefined || value === null || value === "") return undefined;
  const number = Number(value);
  if (!Number.isInteger(number)) {
    throw validationError(field, `${field} must be an integer.`);
  }
  return number;
}

function stripUndefined<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  ) as Partial<T>;
}

function validationError(field: string, message: string) {
  return Errors.fieldValidationError(field, message);
}
