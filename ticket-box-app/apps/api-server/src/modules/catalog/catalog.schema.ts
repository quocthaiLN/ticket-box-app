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

function asOptionalString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}
