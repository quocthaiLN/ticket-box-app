import { auditRepository } from "./audit.repository.js";
import type {
  AuditListQuery,
  AuditLog,
  AuditRecordInput,
  AuditRecordOptions,
} from "./audit.types.js";

const SENSITIVE_KEY_PATTERN =
  /(password|passwd|pwd|token|secret|credential|private[_-]?key|authorization|cookie|otp|api[_-]?key)/i;
const MAX_DEPTH = 6;
const MAX_ARRAY_ITEMS = 50;

function sanitizeMetadata(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return "[TRUNCATED]";
  if (value === null) return value;
  if (value === undefined) return undefined;

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((item) => sanitizeMetadata(item, depth + 1));
  }

  if (typeof value === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        sanitized[key] = "[REDACTED]";
        continue;
      }
      const sanitizedItem = sanitizeMetadata(item, depth + 1);
      if (sanitizedItem !== undefined) {
        sanitized[key] = sanitizedItem;
      }
    }
    return sanitized;
  }

  return String(value);
}

function normalizeMetadata(
  metadata?: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!metadata) return null;
  return sanitizeMetadata(metadata) as Record<string, unknown>;
}

export const auditService = {
  async list(query: AuditListQuery) {
    return auditRepository.findAll(query);
  },

  async record(
    input: AuditRecordInput,
    options: AuditRecordOptions = {},
  ): Promise<AuditLog | null> {
    try {
      return await auditRepository.create({
        ...input,
        metadata: normalizeMetadata(input.metadata),
      });
    } catch (err) {
      if (options.bestEffort) {
        console.error("[audit] Failed to record audit log:", err);
        return null;
      }
      throw err;
    }
  },
};
