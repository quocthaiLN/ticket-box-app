import { ApiError } from "../../shared/http/problem-details.js";

export type ListConcertsQuery = {
  q?: string;
  city?: string;
  from?: string;
  to?: string;
  limit: number;
  cursor?: string;
  sort: "starts_at" | "-starts_at" | "title";
};

export type ListAdminQuery = ListConcertsQuery & {
  status?: "DRAFT" | "PUBLISHED" | "CANCELLED" | "COMPLETED";
  venue_id?: string;
};

export type CreateVenueInput = {
  name: string;
  address: string;
  city: string;
  capacity?: number;
  map_url?: string;
};

export type UpdateVenueInput = Partial<CreateVenueInput>;

export type CreateConcertInput = {
  venue_id: string;
  organizer_id?: string;
  title: string;
  slug: string;
  description?: string;
  artist_name: string;
  artist_bio?: string;
  starts_at: string;
  ends_at: string;
  cover_image_url?: string;
  cover_image_object_key?: string;
  seat_map_url?: string;
  seat_map_object_key?: string;
};

export type UpdateConcertInput = Partial<Omit<CreateConcertInput, "organizer_id">>;

export type CreateSeatZoneInput = {
  code: string;
  name: string;
  description?: string;
  capacity: number;
  svg_path?: string;
  sort_order: number;
};

export type UpdateSeatZoneInput = Partial<CreateSeatZoneInput>;

export type CreateTicketTypeInput = {
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

export type UpdateTicketTypeInput = Partial<CreateTicketTypeInput> & {
  status?: "DRAFT" | "ON_SALE" | "SOLD_OUT" | "CLOSED";
};

const allowedSorts = new Set(["starts_at", "-starts_at", "title"]);

export function parseCatalogListQuery(query: Record<string, unknown>): ListConcertsQuery {
  const requestedLimit = Number(query.limit ?? 20);
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 20;
  const sort = typeof query.sort === "string" && allowedSorts.has(query.sort) ? query.sort : "starts_at";

  return {
    q: asOptionalString(query.q),
    city: asOptionalString(query.city),
    from: asOptionalString(query.from),
    to: asOptionalString(query.to),
    limit,
    cursor: asOptionalString(query.cursor),
    sort: sort as ListConcertsQuery["sort"]
  };
}

export function parseAdminConcertsQuery(query: Record<string, unknown>): ListAdminQuery {
  return {
    ...parseCatalogListQuery(query),
    status: asOptionalString(query.status) as ListAdminQuery["status"],
    venue_id: asOptionalString(query.venue_id)
  };
}

export function parseCreateVenueBody(body: unknown): CreateVenueInput {
  const value = asRecord(body);
  return {
    name: requiredString(value.name, "name"),
    address: requiredString(value.address, "address"),
    city: requiredString(value.city, "city"),
    capacity: optionalPositiveInt(value.capacity, "capacity"),
    map_url: asOptionalString(value.map_url)
  };
}

export function parseUpdateVenueBody(body: unknown): UpdateVenueInput {
  const value = asRecord(body);
  return stripUndefined({
    name: asOptionalString(value.name),
    address: asOptionalString(value.address),
    city: asOptionalString(value.city),
    capacity: optionalPositiveInt(value.capacity, "capacity"),
    map_url: asOptionalString(value.map_url)
  });
}

export function parseCreateConcertBody(body: unknown): CreateConcertInput {
  const value = asRecord(body);
  return {
    venue_id: requiredString(value.venue_id, "venue_id"),
    organizer_id: asOptionalString(value.organizer_id),
    title: requiredString(value.title, "title"),
    slug: requiredString(value.slug, "slug"),
    description: asOptionalString(value.description),
    artist_name: requiredString(value.artist_name, "artist_name"),
    artist_bio: asOptionalString(value.artist_bio),
    starts_at: requiredDateString(value.starts_at, "starts_at"),
    ends_at: requiredDateString(value.ends_at, "ends_at"),
    cover_image_url: asOptionalString(value.cover_image_url),
    cover_image_object_key: asOptionalString(value.cover_image_object_key),
    seat_map_url: asOptionalString(value.seat_map_url),
    seat_map_object_key: asOptionalString(value.seat_map_object_key)
  };
}

export function parseUpdateConcertBody(body: unknown): UpdateConcertInput {
  const value = asRecord(body);
  return stripUndefined({
    venue_id: asOptionalString(value.venue_id),
    title: asOptionalString(value.title),
    slug: asOptionalString(value.slug),
    description: asOptionalString(value.description),
    artist_name: asOptionalString(value.artist_name),
    artist_bio: asOptionalString(value.artist_bio),
    starts_at: optionalDateString(value.starts_at, "starts_at"),
    ends_at: optionalDateString(value.ends_at, "ends_at"),
    cover_image_url: asOptionalString(value.cover_image_url),
    cover_image_object_key: asOptionalString(value.cover_image_object_key),
    seat_map_url: asOptionalString(value.seat_map_url),
    seat_map_object_key: asOptionalString(value.seat_map_object_key)
  });
}

export function parseCreateSeatZoneBody(body: unknown): CreateSeatZoneInput {
  const value = asRecord(body);
  return {
    code: requiredString(value.code, "code").toUpperCase(),
    name: requiredString(value.name, "name"),
    description: asOptionalString(value.description),
    capacity: requiredPositiveInt(value.capacity, "capacity"),
    svg_path: asOptionalString(value.svg_path),
    sort_order: optionalInt(value.sort_order, "sort_order") ?? 0
  };
}

export function parseUpdateSeatZoneBody(body: unknown): UpdateSeatZoneInput {
  const value = asRecord(body);
  return stripUndefined({
    code: asOptionalString(value.code)?.toUpperCase(),
    name: asOptionalString(value.name),
    description: asOptionalString(value.description),
    capacity: optionalPositiveInt(value.capacity, "capacity"),
    svg_path: asOptionalString(value.svg_path),
    sort_order: optionalInt(value.sort_order, "sort_order")
  });
}

export function parseCreateTicketTypeBody(body: unknown): CreateTicketTypeInput {
  const value = asRecord(body);
  return {
    seat_zone_id: requiredString(value.seat_zone_id, "seat_zone_id"),
    name: requiredString(value.name, "name"),
    description: asOptionalString(value.description),
    price: parseMoney(value.price),
    total_quantity: requiredPositiveInt(value.total_quantity, "total_quantity"),
    max_per_user: requiredPositiveInt(value.max_per_user, "max_per_user"),
    sale_start_at: requiredDateString(value.sale_start_at, "sale_start_at"),
    sale_end_at: requiredDateString(value.sale_end_at, "sale_end_at")
  };
}

export function parseUpdateTicketTypeBody(body: unknown): UpdateTicketTypeInput {
  const value = asRecord(body);
  return stripUndefined({
    seat_zone_id: asOptionalString(value.seat_zone_id),
    name: asOptionalString(value.name),
    description: asOptionalString(value.description),
    price: value.price === undefined ? undefined : parseMoney(value.price),
    total_quantity: optionalPositiveInt(value.total_quantity, "total_quantity"),
    max_per_user: optionalPositiveInt(value.max_per_user, "max_per_user"),
    sale_start_at: optionalDateString(value.sale_start_at, "sale_start_at"),
    sale_end_at: optionalDateString(value.sale_end_at, "sale_end_at"),
    status: parseTicketTypeStatus(value.status)
  });
}

function asOptionalString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
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

function optionalInt(value: unknown, field: string) {
  if (value === undefined || value === null || value === "") return undefined;
  const number = Number(value);
  if (!Number.isInteger(number)) {
    throw validationError(field, `${field} must be an integer.`);
  }
  return number;
}

function requiredPositiveInt(value: unknown, field: string) {
  const number = optionalPositiveInt(value, field);
  if (number === undefined) {
    throw validationError(field, `${field} is required.`);
  }
  return number;
}

function optionalPositiveInt(value: unknown, field: string) {
  const number = optionalInt(value, field);
  if (number !== undefined && number <= 0) {
    throw validationError(field, `${field} must be greater than 0.`);
  }
  return number;
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

function parseMoney(value: unknown): { amount: number; currency: "VND" } {
  const money = asRecord(value);
  const amount = Number(money.amount);
  if (!Number.isFinite(amount) || amount < 0) {
    throw validationError("price.amount", "price.amount must be a non-negative number.");
  }

  if (money.currency !== undefined && money.currency !== "VND") {
    throw validationError("price.currency", "Only VND is supported.");
  }

  return { amount, currency: "VND" };
}

function parseTicketTypeStatus(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined;
  if (value === "DRAFT" || value === "ON_SALE" || value === "SOLD_OUT" || value === "CLOSED") {
    return value;
  }
  throw validationError("status", "status must be one of DRAFT, ON_SALE, SOLD_OUT, CLOSED.");
}

function stripUndefined<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as Partial<T>;
}

function validationError(field: string, message: string) {
  return new ApiError({
    type: "https://api.ticketbox.vn/errors/invalid-catalog-request",
    title: "Invalid catalog request",
    status: 400,
    code: "INVALID_CATALOG_REQUEST",
    detail: message,
    errors: [{ field, message }]
  });
}
