import { Errors } from "../../shared/http/problem-details.js";
import type {
  CheckinPreloadQuery,
  CheckinScanRequest,
  CreateDeviceRequest,
  CreateGateRequest,
  CreateGateZoneMappingRequest,
  OfflineBatchRequest,
  OfflineSyncRequest,
  ReplaceGateZonesRequest,
  UpdateDeviceRequest,
  UpdateGateRequest
} from "./checkin.types.js";

// Parse body quét vé online và kiểm tra phải có một dạng QR hợp lệ.
export function parseCheckinScanBody(body: unknown): CheckinScanRequest {
  const value = asRecord(body);
  const request: CheckinScanRequest = {
    concert_id: requiredString(value.concert_id, "concert_id"),
    device_id: requiredString(value.device_id, "device_id"),
    gate_id: requiredString(value.gate_id, "gate_id"),
    qr_payload: value.qr_payload ?? value.qrPayload,
    qr_token: optionalString(value.qr_token) ?? optionalString(value.qrToken),
    qr_signature: optionalString(value.qr_signature) ?? optionalString(value.qrSignature),
    ticket_code: optionalString(value.ticket_code),
    qr_payload_hash: optionalString(value.qr_payload_hash),
    scanned_at: optionalIsoString(value.scanned_at, "scanned_at"),
    staff_user_id: optionalString(value.staff_user_id)
  };

  if (!request.ticket_code && !request.qr_payload_hash && !request.qr_token && !request.qr_payload) {
    throw validationError("qr_payload", "qr_payload, qr_token, ticket_code, or qr_payload_hash is required.");
  }

  return request;
}

// Parse query preload dữ liệu check-in cho thiết bị/gate.
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

// Parse body đồng bộ các item scan offline lên server.
export function parseOfflineSyncBody(body: unknown, routeBatchId?: string): OfflineSyncRequest {
  const value = asRecord(body);
  const items = Array.isArray(value.items) ? value.items : undefined;

  if (!items || items.length === 0) {
    throw validationError("items", "items must contain at least one offline scan item.");
  }

  return {
    device_id: optionalString(value.device_id),
    staff_user_id: optionalString(value.staff_user_id),
    batch_id: optionalString(routeBatchId) ?? optionalString(value.batch_id) ?? requiredString(value.batch_token, "batch_id"),
    concert_id: optionalString(value.concert_id),
    gate_id: optionalString(value.gate_id),
    items: items.map((item, index) => {
      const row = asRecord(item, `items.${index}`);
      const ticketCode = optionalString(row.ticket_code);
      const qrPayloadHash = optionalString(row.qr_payload_hash);
      const qrToken = optionalString(row.qr_token);
      const ticketId = optionalString(row.ticket_id);
      const guestId = optionalString(row.guest_id);
      const phone = optionalString(row.phone);

      if (!ticketCode && !qrPayloadHash && !qrToken && !ticketId && !guestId && !phone) {
        throw validationError(`items.${index}`, "ticket_id, guest_id, phone, qr_token, ticket_code, or qr_payload_hash is required.");
      }

      return {
        client_item_id: requiredString(row.client_item_id, `items.${index}.client_item_id`),
        type: parseOfflineItemType(row.type),
        ticket_id: ticketId,
        guest_id: guestId,
        phone,
        qr_token: qrToken,
        ticket_code: ticketCode,
        qr_payload_hash: qrPayloadHash,
        concert_id: optionalString(row.concert_id) ?? optionalString(value.concert_id) ?? requiredString(row.concert_id, `items.${index}.concert_id`),
        gate_id: optionalString(row.gate_id) ?? optionalString(value.gate_id) ?? requiredString(row.gate_id, `items.${index}.gate_id`),
        seat_zone_id: optionalString(row.seat_zone_id),
        zone_id: optionalString(row.zone_id),
        scanned_at: optionalIsoString(row.local_scanned_at, `items.${index}.local_scanned_at`) ?? requiredIsoString(row.scanned_at, `items.${index}.scanned_at`)
      };
    })
  };
}

// Parse body tạo batch sync offline idempotent.
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

// Parse body tạo cổng check-in mới cho concert.
export function parseCreateGateBody(body: unknown, routeConcertId?: string): CreateGateRequest {
  const value = asRecord(body);

  return {
    concert_id: routeConcertId ?? requiredString(value.concert_id, "concert_id"),
    code: requiredString(value.code, "code"),
    name: requiredString(value.name, "name"),
    description: optionalString(value.description),
    is_active: value.is_active === undefined ? true : asBoolean(value.is_active, "is_active"),
    sort_order: asInteger(value.sort_order, "sort_order", 0)
  };
}

// Parse body cập nhật cổng check-in, chỉ nhận các field được gửi lên.
export function parseUpdateGateBody(body: unknown): UpdateGateRequest {
  const value = asRecord(body);
  const output: UpdateGateRequest = {};

  if ("code" in value) output.code = requiredString(value.code, "code");
  if ("name" in value) output.name = requiredString(value.name, "name");
  if ("description" in value) output.description = optionalNullableString(value.description, "description");
  if ("is_active" in value) output.is_active = asBoolean(value.is_active, "is_active");
  if ("sort_order" in value) output.sort_order = asInteger(value.sort_order, "sort_order", 0);

  return output;
}

// Parse body đăng ký thiết bị check-in mới.
export function parseCreateDeviceBody(body: unknown): CreateDeviceRequest {
  const value = asRecord(body);

  return {
    device_code: requiredString(value.device_code ?? value.deviceCode, "device_code"),
    staff_id: requiredString(value.staff_id, "staff_id"),
    concert_id: requiredString(value.concert_id, "concert_id"),
    gate_id: requiredString(value.gate_id, "gate_id"),
    name: optionalString(value.name ?? value.device_name)
  };
}

// Parse body cập nhật thiết bị check-in và validate trạng thái thiết bị.
export function parseUpdateDeviceBody(body: unknown): UpdateDeviceRequest {
  const value = asRecord(body);
  const output: UpdateDeviceRequest = {};

  if ("device_code" in value || "deviceCode" in value) {
    output.device_code = requiredString(value.device_code ?? value.deviceCode, "device_code");
  }
  if ("staff_id" in value) output.staff_id = requiredString(value.staff_id, "staff_id");
  if ("gate_id" in value) output.gate_id = requiredString(value.gate_id, "gate_id");
  if ("name" in value || "device_name" in value) {
    output.name = optionalNullableString(value.name ?? value.device_name, "name");
  }
  if ("status" in value) {
    const status = requiredString(value.status, "status");
    if (!["ACTIVE", "REVOKED", "LOST"].includes(status)) {
      throw validationError("status", "status must be ACTIVE, REVOKED, or LOST.");
    }
    output.status = status as UpdateDeviceRequest["status"];
  }

  return output;
}

// Parse body tạo mapping giữa cổng và khu vé.
export function parseCreateGateZoneMappingBody(body: unknown): CreateGateZoneMappingRequest {
  const value = asRecord(body);

  return {
    gate_id: requiredString(value.gate_id, "gate_id"),
    seat_zone_id: requiredString(value.seat_zone_id ?? value.zone_id, "seat_zone_id")
  };
}

// Parse body thay toàn bộ danh sách khu vé được phép của một cổng.
export function parseReplaceGateZonesBody(body: unknown): ReplaceGateZonesRequest {
  const value = asRecord(body);
  const ids = value.seat_zone_ids ?? value.zone_ids;

  if (!Array.isArray(ids)) {
    throw validationError("seat_zone_ids", "seat_zone_ids must be an array.");
  }

  return {
    seat_zone_ids: ids.map((id, index) => requiredString(id, `seat_zone_ids.${index}`))
  };
}

// Parse query list chung cho các màn admin có phân trang giới hạn.
export function parseListLimitQuery(query: Record<string, unknown>, defaultLimit = 50) {
  return {
    concert_id: optionalString(query.concert_id),
    gate_id: optionalString(query.gate_id),
    limit: parseLimit(query.limit, defaultLimit),
    cursor: optionalString(query.cursor)
  };
}

// Chuẩn hoá limit và chặn giá trị quá nhỏ hoặc quá lớn.
function parseLimit(value: unknown, defaultLimit: number) {
  const requestedLimit = Number(value ?? defaultLimit);
  return Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 5000) : defaultLimit;
}

// Ép input thành object để parser không xử lý nhầm array/null.
function asRecord(value: unknown, field = "body"): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw validationError(field, `${field} must be an object.`);
  }

  return value as Record<string, unknown>;
}

// Lấy string bắt buộc và ném lỗi validation nếu thiếu.
function requiredString(value: unknown, field: string) {
  const parsed = optionalString(value);

  if (!parsed) {
    throw validationError(field, `${field} is required.`);
  }

  return parsed;
}

// Lấy string optional đã trim, bỏ qua chuỗi rỗng.
function optionalString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

// Lấy timestamp ISO bắt buộc.
function requiredIsoString(value: unknown, field: string) {
  return optionalIsoString(value, field) ?? requiredString(value, field);
}

// Parse field string cho phép null khi admin muốn xoá mô tả/tên phụ.
function optionalNullableString(value: unknown, field: string) {
  if (value === null) {
    return null;
  }

  if (value === undefined) {
    return undefined;
  }

  const parsed = optionalString(value);

  if (parsed === undefined) {
    throw validationError(field, `${field} must be a non-empty string or null.`);
  }

  return parsed;
}

// Parse boolean từ boolean thật hoặc chuỗi true/false.
function asBoolean(value: unknown, field: string) {
  if (typeof value === "boolean") {
    return value;
  }

  if (value === "true") return true;
  if (value === "false") return false;

  throw validationError(field, `${field} must be a boolean.`);
}

// Parse số nguyên với giá trị mặc định khi field không được gửi.
function asInteger(value: unknown, field: string, defaultValue: number) {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    throw validationError(field, `${field} must be an integer.`);
  }

  return parsed;
}

// Parse timestamp ISO optional và báo lỗi nếu định dạng sai.
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

function parseOfflineItemType(value: unknown): "TICKET" | "GUEST" | undefined {
  const parsed = optionalString(value)?.toUpperCase();
  if (!parsed) return undefined;
  if (parsed === "TICKET" || parsed === "GUEST") return parsed;
  throw validationError("type", "type must be TICKET or GUEST.");
}

function validationError(field: string, message: string) {
  return Errors.fieldValidationError(field, message);
}
