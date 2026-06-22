# TicketBox — Inventory API Design

Tài liệu này thiết kế API vận hành tồn kho vé. Public read tồn kho cho UI nằm trong `catalog-api.md`; file này tập trung vào nghiệp vụ thay đổi tồn kho an toàn: hold, release, payment confirmed và admin adjustment.

Nguồn nghiệp vụ chính:

- `blueprint/specs/01-ticket-inventory.md`
- `blueprint/specs/02-per-user-ticket-limit.md`
- `blueprint/database-design.md`

---

## 1. Mục tiêu

- Chống oversell bằng PostgreSQL transaction và row-level lock.
- Duy trì bất biến: `total_quantity >= held_quantity + sold_quantity`.
- `available_quantity` là computed field: `total_quantity - held_quantity - sold_quantity`.
- Không dùng Redis làm source of truth khi quyết định bán vé.
- Cho phép admin xem/tạo audit nghiệp vụ qua `audit_logs`; MVP không có bảng `ticket_inventory_events` riêng.

---

## 2. Resource và mapping database

| Resource | Bảng | Vai trò |
| --- | --- | --- |
| `ticket_type_inventory` | `ticket_types` | Số lượng tổng/giữ/đã bán theo loại vé. |
| `user_ticket_type_counter` | `user_ticket_type_counters` | Enforce `max_per_user`. |
| `order` | `orders`, `order_items` | Nguồn thay đổi hold/release/payment. |
| `audit_log` | `audit_logs` | Audit thao tác admin/nghiệp vụ quan trọng. |

---

## 3. Endpoint tổng hợp

| Method | Endpoint | Auth | Mục đích |
| --- | --- | --- | --- |
| `POST` | `/internal/inventory/holds` | Internal/Ticketing | Hold vé khi tạo order. |
| `POST` | `/internal/inventory/releases` | Internal/Worker | Release hold khi order hết hạn/hủy. |
| `POST` | `/internal/inventory/payment-confirmations` | Internal/Payment | Chuyển held sang sold khi payment thành công. |

> **Sprint 6:** `GET /admin/ticket-types/{id}/inventory` **chuyển** sang `GET /organizer/ticket-types/{id}/inventory` (role `ORGANIZER`, filter theo ownership; xem `organizer-api.md`); `POST /admin/ticket-types/{id}/inventory-adjustments` **đã bỏ** (trả `404`). File này còn lại các route `/internal/*` (không JWT người dùng).

Internal endpoints có thể là module method nội bộ trong modular monolith; nếu expose HTTP thì chỉ nằm trong private network và bắt buộc service auth.

---

## 4. API chi tiết

### 4.1. `GET /admin/ticket-types/{ticket_type_id}/inventory` — CHUYỂN sang organizer (sprint 6)

Tồn kho source-of-truth theo loại vé nay phục vụ qua `GET /organizer/ticket-types/{ticket_type_id}/inventory` (role `ORGANIZER`, verify ownership concert; xem `organizer-api.md`). Route admin cũ trả `404`. Cấu trúc response giữ nguyên dưới đây làm tham chiếu.

Response `200`:

```json
{
  "data": {
    "ticket_type_id": "tkt_01JX9Q5A",
    "concert_id": "crt_01JX9Q2M5P7KZ3R4N8Y6",
    "seat_zone_id": "zon_01JX9Q4A",
    "total_quantity": 200,
    "available_quantity": 118,
    "held_quantity": 12,
    "sold_quantity": 70,
    "status": "ON_SALE",
    "updated_at": "2026-05-30T10:15:30Z"
  },
  "meta": {
    "request_id": "req_01JX9Q6N4E",
    "computed_fields": ["available_quantity"]
  }
}
```

### 4.2. `POST /internal/inventory/holds`

Hold vé cho order. Endpoint này phải chạy trong transaction.

Auth: JWT Bearer token (user). `user_id` được extract từ JWT payload (`sub` claim), không nhận từ request body để tránh giả mạo.

Headers:

```http
Authorization: Bearer <jwt_token>
Idempotency-Key: hold_usr_01JX_tkt_01JX_0001
```

Request:

```json
{
  "concert_id": "crt_01JX9Q2M5P7KZ3R4N8Y6",
  "items": [
    {
      "ticket_type_id": "tkt_01JX9Q5A",
      "quantity": 2
    }
  ],
  "hold_expires_at": "2026-05-30T10:25:30Z"
}
```

Response `201`:

```json
{
  "data": {
    "order_id": "ord_01JX9QA1",
    "status": "HELD",
    "hold_expires_at": "2026-05-30T10:25:30Z",
    "items": [
      {
        "ticket_type_id": "tkt_01JX9Q5A",
        "quantity": 2,
        "available_quantity_after": 116
      }
    ]
  },
  "meta": {
    "request_id": "req_01JX9Q6N4E"
  }
}
```

Transaction rules:

1. Lock `ticket_types` rows bằng `SELECT ... FOR UPDATE`.
2. Lock hoặc tạo `user_ticket_type_counters`.
3. Tính computed `available_quantity` và kiểm tra đủ vé.
4. Kiểm tra sale window và `status = ON_SALE`.
5. Kiểm tra `held_quantity + paid_quantity + quantity <= max_per_user`.
6. Tạo order/order items.
7. Tăng `ticket_types.held_quantity`, tăng user held counter.
8. Commit rồi mới cập nhật/invalidate Redis inventory.

### 4.3. `POST /internal/inventory/releases`

Release vé đang hold khi order hết hạn hoặc bị hủy.

Auth: Internal service auth (không có user JWT). Endpoint này được gọi bởi background worker (scheduler/job queue) khi order hết hạn, hoặc bởi order module khi user hủy. Trong modular monolith thường là direct module call; nếu expose HTTP thì giới hạn private network + service token.

```json
{
  "order_id": "ord_01JX9QA1",
  "reason": "HOLD_EXPIRED"
}
```

Response `200`:

```json
{
  "data": {
    "order_id": "ord_01JX9QA1",
    "status": "EXPIRED",
    "released_items": [
      {
        "ticket_type_id": "tkt_01JX9Q5A",
        "quantity": 2
      }
    ]
  },
  "meta": {
    "request_id": "req_01JX9Q6N4E"
  }
}
```

Idempotent rule: nếu order không còn `HELD`, trả trạng thái hiện tại và không thay đổi tồn kho lần hai.

### 4.4. `POST /internal/inventory/payment-confirmations`

Chuyển inventory từ held sang sold sau webhook payment hợp lệ.

Auth: Không có user JWT. Endpoint này được trigger bởi message consumer (event-driven) sau khi Payment module publish event `payment.succeeded` lên message broker. Không expose HTTP ra ngoài; nếu cần HTTP thì chỉ private network + service token. Không cần verify user identity — chỉ cần verify `order_id` và `payment_id` hợp lệ trong DB.

```json
{
  "order_id": "ord_01JX9QA1",
  "payment_id": "pay_01JX9QB2"
}
```

Side effects:

- `orders.status = CONFIRMED`.
- `ticket_types.held_quantity -= quantity`.
- `ticket_types.sold_quantity += quantity`.
- user counter chuyển held sang paid.
- Phát hành ticket ở Ticketing/E-ticket module.
- Ghi `audit_logs` nếu đây là thao tác admin/manual hoặc cần đối soát.

### 4.5. `POST /admin/ticket-types/{ticket_type_id}/inventory-adjustments` — ĐÃ BỎ (sprint 6)

Route điều chỉnh tồn kho thủ công đã bỏ (trả `404`) trong scope refactor sprint 6. Mô tả bên dưới giữ làm tham chiếu lịch sử.

Headers:

```http
Authorization: Bearer <jwt_token>  (role = ADMIN)
```

```json
{
  "delta_total_quantity": 50,
  "reason": "Mở thêm khu vực ghế bổ sung."
}
```

Response `200`:

```json
{
  "data": {
    "ticket_type_id": "tkt_01JX9Q5A",
    "total_quantity": 250,
    "available_quantity": 168,
    "audit_log_id": "aud_01JX9QK3"
  },
  "meta": {
    "request_id": "req_01JX9Q6N4E",
    "computed_fields": ["available_quantity"]
  }
}
```

Ràng buộc:

- Không làm computed `available_quantity` âm.
- Không làm tổng vé vượt `seat_zones.capacity`.
- Ghi audit log `INVENTORY_ADJUSTED`.

---

## 5. Error catalog

| HTTP | Code | Khi nào xảy ra |
| --- | --- | --- |
| `409` | `TICKET_SOLD_OUT` | Không đủ computed `available_quantity`. |
| `409` | `PER_USER_LIMIT_EXCEEDED` | Vượt `max_per_user`. |
| `409` | `ORDER_NOT_HELD` | Release/confirm order không ở trạng thái phù hợp. |
| `422` | `TICKET_TYPE_NOT_ON_SALE` | Chưa mở bán, hết hạn bán hoặc status không hợp lệ. |
| `422` | `INVENTORY_INVARIANT_VIOLATED` | `held_quantity + sold_quantity > total_quantity`. |
| `422` | `ZONE_CAPACITY_EXCEEDED` | Điều chỉnh vượt capacity khu. |
| `503` | `LOCK_TIMEOUT_RETRYABLE` | DB lock timeout/deadlock, client/worker có thể retry. |

---

## 6. Acceptance criteria

- Hai request cùng mua vé cuối cùng chỉ một request thành công.
- Không bao giờ có computed `available_quantity < 0`.
- Order hết hạn release đúng số lượng.
- Payment success chuyển held sang sold đúng một lần.
- Không còn phụ thuộc bảng `ticket_inventory_events`.
- `GET /admin/ticket-types/{id}/inventory` → 404; tồn kho cho BTC qua `GET /organizer/ticket-types/{id}/inventory`.