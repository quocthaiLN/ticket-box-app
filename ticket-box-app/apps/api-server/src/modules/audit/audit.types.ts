export type AuditActor = {
  id: string;
  email: string;
  full_name: string;
  role: string;
} | null;

export type AuditLog = {
  id: string;
  actor_user_id: string | null;
  actor: AuditActor;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: Date;
};

export type AuditListQuery = {
  actor_user_id?: string;
  action?: string;
  entity_type?: string;
  entity_id?: string;
  from?: string;
  to?: string;
  limit: number;
  cursor?: string;
};

export type AuditRecordInput = {
  actor_user_id?: string | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  metadata?: Record<string, unknown> | null;
  ip_address?: string | null;
  user_agent?: string | null;
};

export type AuditRecordOptions = {
  bestEffort?: boolean;
};
