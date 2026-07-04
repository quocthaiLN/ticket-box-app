import { randomInt } from "crypto";
import { Errors } from "../../shared/http/problem-details.js";
import { hashPassword } from "../auth/auth.utils.js";
import {
  OrganizerAdminRepository,
  type ProvisionChecker,
  type ProvisionZone,
} from "./organizer-admin.repository.js";
import {
  assertApprovalStatus,
  parseStoredTicketTypes,
  type AdminListQuery,
  type StoredTicketType,
} from "./organizer-admin.schema.js";

export class OrganizerAdminService {
  constructor(private readonly repository = new OrganizerAdminRepository()) {}

  // ── Organizer requests ────────────────────────────────────────────────────
  listRequests(query: AdminListQuery) {
    assertApprovalStatus(query.status);
    return this.repository.listRequests(query);
  }

  async getRequest(requestId: string) {
    const request = await this.repository.getRequestDetail(requestId);
    if (!request) {
      throw Errors.organizerRequestNotFound(requestId);
    }
    return request;
  }

  async approveRequest(requestId: string, adminId: string) {
    const request = await this.repository.getRequestDetail(requestId);
    if (!request) {
      throw Errors.organizerRequestNotFound(requestId);
    }
    if (request.status !== "PENDING") {
      throw Errors.organizerRequestNotPending();
    }

    const ticketTypes = parseStoredTicketTypes(request.ticket_types);
    const zones = computeZones(ticketTypes);
    const slug = `${slugify(request.title)}-${randomSuffix()}`;
    const checkers = await buildCheckers(request.checker_count, slug, request.title);

    return this.repository.approveRequest({
      requestId,
      adminId,
      slug,
      zones,
      ticketTypes,
      checkers,
    });
  }

  async rejectRequest(requestId: string, adminId: string, reviewNote?: string) {
    const existing = await this.repository.getRequestStatus(requestId);
    if (!existing) {
      throw Errors.organizerRequestNotFound(requestId);
    }
    if (existing.status !== "PENDING") {
      throw Errors.organizerRequestNotPending();
    }
    return this.repository.rejectRequest(requestId, adminId, reviewNote);
  }

  // ── Concert deletion requests ─────────────────────────────────────────────
  listDeletionRequests(query: AdminListQuery) {
    assertApprovalStatus(query.status);
    return this.repository.listDeletionRequests(query);
  }

  async approveDeletion(requestId: string, adminId: string) {
    const request = await this.repository.getDeletionRequest(requestId);
    if (!request) {
      throw Errors.deletionRequestNotFound(requestId);
    }
    if (request.status !== "PENDING") {
      throw Errors.deletionRequestNotPending();
    }
    return this.repository.approveDeletion(requestId, request.concertId, adminId);
  }

  async rejectDeletion(requestId: string, adminId: string, reviewNote?: string) {
    const request = await this.repository.getDeletionRequest(requestId);
    if (!request) {
      throw Errors.deletionRequestNotFound(requestId);
    }
    if (request.status !== "PENDING") {
      throw Errors.deletionRequestNotPending();
    }
    return this.repository.rejectDeletion(requestId, adminId, reviewNote);
  }

  // ── Checker accounts ──────────────────────────────────────────────────────
  async listCheckerAccounts(concertId: string, query: AdminListQuery) {
    if (!(await this.repository.concertExists(concertId))) {
      throw Errors.concertNotFound(concertId);
    }
    return this.repository.listCheckerAccounts(concertId, query);
  }
}

/** Gom ticket types theo zone_code; capacity lấy min (khớp validate lúc tạo hồ sơ). */
function computeZones(ticketTypes: StoredTicketType[]): ProvisionZone[] {
  const zones = new Map<string, ProvisionZone>();
  for (const ticketType of ticketTypes) {
    const existing = zones.get(ticketType.zone_code);
    if (existing) {
      existing.capacity = Math.min(existing.capacity, ticketType.zone_capacity);
    } else {
      zones.set(ticketType.zone_code, {
        code: ticketType.zone_code,
        name: ticketType.zone_name,
        capacity: ticketType.zone_capacity,
      });
    }
  }
  return [...zones.values()];
}

async function buildCheckers(
  count: number,
  slug: string,
  title: string,
): Promise<ProvisionChecker[]> {
  const checkers: ProvisionChecker[] = [];
  for (let i = 1; i <= count; i++) {
    const plaintext = generatePassword();
    checkers.push({
      email: `checker-${slug}-${i}@ticketbox.local`,
      fullName: `Checker ${i} — ${title}`,
      passwordHash: await hashPassword(plaintext),
      plaintext,
    });
  }
  return checkers;
}

function slugify(title: string): string {
  const base = title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base.length > 0 ? base : "concert";
}

function randomSuffix(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let suffix = "";
  for (let i = 0; i < 4; i++) {
    suffix += alphabet[randomInt(alphabet.length)];
  }
  return suffix;
}

/** Mật khẩu ngẫu nhiên mạnh — chỉ trả về một lần ở response approve. */
function generatePassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  const special = "!@#$%&*";
  const all = upper + lower + digits + special;

  const chars = [
    upper[randomInt(upper.length)],
    lower[randomInt(lower.length)],
    digits[randomInt(digits.length)],
    special[randomInt(special.length)],
  ];
  for (let i = chars.length; i < 12; i++) {
    chars.push(all[randomInt(all.length)]);
  }

  // Fisher–Yates shuffle để không cố định vị trí 4 ký tự bắt buộc.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join("");
}
