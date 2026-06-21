# TicketBox — Notification API — Modification (sprint 6 role/route refactor)

Tài liệu này mô tả **thay đổi** áp lên [`notification-api.md`](notification-api.md) theo đợt refactor role/route (`template2.md`).

Tóm tắt: notification admin chuyển về **single-role `ADMIN`** (quyết định "suy nghĩ sau"). Path không đổi.

---

## 1. Thay đổi guard

| Route | Trước | Sau |
| --- | --- | --- |
| `GET /admin/notifications` | `ORGANIZER, ADMIN` | **`ADMIN`** |
| `GET /admin/notifications/:notification_id` | `ORGANIZER, ADMIN` | **`ADMIN`** |
| `POST /admin/notifications/:notification_id/retry` | `ORGANIZER, ADMIN` | **`ADMIN`** |
| `POST /internal/notifications/enqueue` | Internal (`ADMIN`) | Internal (`ADMIN`) — không đổi |

Trong `notifications.router.ts`: đổi `adminOnly = [requireAuth, requireRole("ORGANIZER","ADMIN")]` → `requireRole("ADMIN")`.

---

## 2. Cập nhật bảng RBAC (doc gốc §6)

| Endpoint group | `GUEST` | `AUDIENCE` | `ORGANIZER` | `ADMIN` |
| --- | --- | --- | --- | --- |
| Notification list/detail | 401 | 403 | **403** | Allow |
| Retry notification | 401 | 403 | **403** | Allow |
| Internal enqueue | Internal only | Internal only | Internal only | Internal only |

Cột `ORGANIZER` đổi từ "Allow scoped by concert" → **403**. Bỏ ghi chú "Organizer chỉ thấy notification thuộc concert mình quản lý" ở §8 (acceptance criteria) hoặc thay bằng: notification tra cứu chỉ dành cho `ADMIN`.

---

## 3. Acceptance criteria (bổ sung)

- ADMIN → `GET /v1/admin/notifications` = 200.
- ORGANIZER → `GET /v1/admin/notifications` = 403.
