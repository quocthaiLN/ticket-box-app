import { apiGet, type ApiCollectionResponse } from "../lib/api-client";

export type AdminAuditActor = {
  id: string;
  email: string;
  full_name: string;
  role: string;
} | null;

export type AdminAuditLog = {
  id: string;
  actor_user_id: string | null;
  actor: AdminAuditActor;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
};

export type AdminAuditFilter = {
  action?: string;
  entity_type?: string;
  entity_id?: string;
  actor_user_id?: string;
  from?: string;
  to?: string;
};

export async function listAdminAuditLogs(
  filter: AdminAuditFilter,
  cursor?: string,
  limit = 30,
): Promise<{ items: AdminAuditLog[]; nextCursor: string | null }> {
  const query = new URLSearchParams({ limit: String(limit) });
  for (const [key, value] of Object.entries(filter)) {
    const trimmed = value?.trim();
    if (trimmed) query.set(key, trimmed);
  }
  if (cursor) query.set("cursor", cursor);

  const response = await apiGet<ApiCollectionResponse<AdminAuditLog>>(
    `/admin/audit-logs?${query.toString()}`,
  );
  return {
    items: response.data,
    nextCursor: response.pagination?.next_cursor ?? null,
  };
}
