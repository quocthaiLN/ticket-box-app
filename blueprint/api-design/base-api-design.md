# API Design Report — TicketBox

Tài liệu này mô tả quy ước chung cho toàn bộ REST API của TicketBox

---

## 1. Quy ước chung cho tất cả API

### 1.1. Base URL và versioning

| Môi trường | Base URL | Ghi chú |
| --- | --- | --- |
| Production API | `https://api.ticketbox.vn/v1` | URL chính cho web, mobile app và admin. |
| CDN Metadata | `https://cdn.ticketbox.vn/api/v1` | Dùng cho dữ liệu tĩnh/cache dài như metadata concert, ảnh, sơ đồ SVG. |
| Local development | `http://localhost:3000/v1` | Dùng khi chạy backend local. |

### 1.2. Giao thức và định dạng dữ liệu

- Giao thức bắt buộc: HTTPS ở môi trường public.
- Request body: `application/json`, trừ API upload file dùng `multipart/form-data`.
- Response thành công: `application/json`.
- Response lỗi: `application/problem+json` theo RFC 7807 mở rộng.
- JSON field dùng `snake_case`.
- URI dùng danh từ số nhiều, `kebab-case` khi cần nhiều từ.
- ID trong API là opaque string. Client không được parse cấu trúc ID; hiện tại backend có thể dùng UUID hoặc prefix ID tùy triển khai.
- Thời gian dùng ISO 8601 có timezone, ưu tiên UTC: `2026-05-30T10:15:30Z`.
- Tiền tệ dùng object gồm `amount` và `currency`; `amount` là số tiền theo đơn vị tiền chính, ví dụ `1500000` VND.

### 1.3. Header chuẩn

| Header | Bắt buộc | Áp dụng | Ý nghĩa |
| --- | --- | --- | --- |
| `Authorization: Bearer <jwt>` | Có với endpoint protected | Web, mobile, admin | Xác thực người dùng và role. |
| `Content-Type: application/json` | Có khi có body JSON | Tất cả API ghi | Kiểu dữ liệu request. |
| `Accept: application/json` | Khuyến nghị | Tất cả API | Kiểu dữ liệu client mong muốn. |
| `X-Request-Id` | Khuyến nghị | Tất cả API | Trace request xuyên hệ thống; server tự sinh nếu thiếu. |
| `Idempotency-Key` | Có với API tạo giao dịch/batch | Order, payment, offline sync | Chống xử lý trùng khi retry. |
| `If-None-Match` | Tùy chọn | API cache được | Client gửi ETag để nhận `304 Not Modified`. |
| `X-Device-Id` | Có với mobile check-in | Check-in | Định danh thiết bị soát vé đã đăng ký. |

Response luôn trả `X-Request-Id` để đối soát log.

### 1.4. Authentication và Authorization

TicketBox dùng JWT stateless kết hợp Redis denylist cho token bị thu hồi.

| Role | Mã role | Quyền chính |
| --- | --- | --- |
| Guest | Không có JWT | Xem catalog public. |
| Khán giả | `AUDIENCE` | Xem catalog, đặt vé, xem vé cá nhân. |
| Ban tổ chức | `ORGANIZER` | Quản lý concert, ticket type, thống kê, upload file. |
| Nhân sự soát vé | `CHECKIN_STAFF`| Preload dữ liệu, check-in online, sync offline. |
| Admin | `ADMIN` | Toàn quyền vận hành và cấu hình. |

API Gateway kiểm tra JWT và role ở vòng ngoài. Backend module tiếp tục kiểm tra quyền sở hữu dữ liệu, ví dụ user chỉ được xem vé của chính mình, checker chỉ được dùng thiết bị/cổng được gán.

### 1.5. Response envelope

Response thành công cho object đơn:

```json
{
  "data": {
    "id": "crt_01JX9Q2M5P7KZ3R4N8Y6"
  },
  "meta": {
    "request_id": "req_01JX9Q6N4E"
  }
}
```

Response thành công cho collection:

```json
{
  "data": [],
  "pagination": {
    "next_cursor": "eyJpZCI6ImNydF8wMSJ9",
    "has_more": false,
    "limit": 20
  },
  "meta": {
    "request_id": "req_01JX9Q6N4E"
  }
}
```

### 1.6. Pagination, filter và sort

Collection endpoint dùng cursor pagination.

| Query | Mặc định | Giới hạn | Ý nghĩa |
| --- | --- | --- | --- |
| `limit` | `20` | Tối đa `100` | Số item trả về. |
| `cursor` | Không có | Opaque string | Vị trí trang tiếp theo. |
| `sort` | Tùy endpoint | Whitelist | Ví dụ `starts_at`, `-starts_at`, `created_at`. |

Filter dùng query string rõ nghĩa, ví dụ:

```http
GET /v1/concerts?city=ho-chi-minh&from=2026-06-01T00:00:00Z&limit=20
```

### 1.7. Lỗi chuẩn RFC 7807

Mọi lỗi trả `Content-Type: application/problem+json`.

```json
{
  "type": "https://api.ticketbox.vn/errors/wrong-gate",
  "title": "Sai cổng soát vé",
  "status": 409,
  "code": "WRONG_GATE",
  "detail": "Vé thuộc khu SVIP nhưng thiết bị đang ở cổng CAT1_GATE.",
  "instance": "/v1/check-in/scans",
  "request_id": "req_01JX9Q6N4E",
  "errors": [
    {
      "field": "gate_id",
      "message": "Gate không được mapping với seat_zone_id của vé."
    }
  ]
}
```

Các mã lỗi dùng chung:

| HTTP | Code | Khi nào dùng |
| --- | --- | --- |
| `400` | `BAD_REQUEST` | Body/query sai định dạng. |
| `401` | `UNAUTHORIZED` | Thiếu hoặc sai JWT. |
| `403` | `FORBIDDEN` | Đúng danh tính nhưng sai quyền. |
| `404` | `NOT_FOUND` | Resource không tồn tại hoặc không được phép lộ. |
| `409` | `CONFLICT` | Trùng trạng thái nghiệp vụ, retry trùng, vé đã check-in. |
| `422` | `VALIDATION_ERROR` | Dữ liệu hợp lệ JSON nhưng sai nghiệp vụ. |
| `429` | `RATE_LIMITED` | Vượt rate limit. |
| `500` | `INTERNAL_ERROR` | Lỗi hệ thống không mong muốn. |
| `503` | `SERVICE_UNAVAILABLE` | Circuit breaker mở hoặc phụ thuộc lõi đang lỗi. |

### 1.8. Idempotency

Các API tạo tác động không được phép chạy trùng phải nhận `Idempotency-Key`.

- Key do client sinh bằng UUID hoặc opaque random string.
- Scope key theo `user_id + route + idempotency_key`.
- Redis lưu trạng thái nhanh với TTL tối thiểu 24 giờ.
- PostgreSQL vẫn có unique constraint để chống trùng tuyệt đối.
- Nếu request cũ đang xử lý, trả `409 IDEMPOTENCY_IN_PROGRESS`.
- Nếu request cũ đã xong, trả lại response cũ với HTTP `200` hoặc `201`.

### 1.9. Rate limiting

API Gateway áp dụng token bucket/sliding window trên Redis.

Response khi vượt ngưỡng:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 30
X-RateLimit-Limit: 200
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1767062400
```

Ngưỡng mặc định:

| Nhóm endpoint | Key | Ngưỡng gợi ý |
| --- | --- | --- |
| Catalog public | IP | `200 requests / phút` |
| Inventory public | IP + concert | `120 requests / phút` |
| Check-in online | staff + device | `600 scans / phút` |
| Offline sync | staff + device | `60 batches / phút` |
| Admin write | user | `60 requests / phút` |

### 1.10. Caching

| Loại dữ liệu | Endpoint | Cache strategy | Header gợi ý |
| --- | --- | --- | --- |
| Concert list/detail metadata | Catalog | Cache-aside + CDN | `Cache-Control: public, s-maxage=86400, stale-while-revalidate=3600` |
| Seat map SVG/ảnh | Catalog/CDN | CDN asset cache | `Cache-Control: public, max-age=31536000, immutable` |
| Inventory còn vé | Catalog/Inventory | Redis TTL ngắn | `Cache-Control: no-store` hoặc `max-age=5` tùy UI |
| Check-in result | Check-in | Không cache | `Cache-Control: no-store` |

Endpoint đọc cache được nên trả `ETag`. Admin update concert/ticket type/zone/bio phải invalidate các key liên quan.

### 1.11. Trạng thái và audit

- API ghi quan trọng phải tạo audit log: admin update, check-in, offline sync, payment webhook, inventory change.
- Check-in phải log mọi lần scan, kể cả `INVALID_TICKET`, `WRONG_GATE`, `ALREADY_CHECKED_IN`.
- API không trả stack trace hoặc thông tin hạ tầng nội bộ.

---