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

Version được đặt trong path (`/v1`). Khi thay đổi breaking change, tạo version mới (`/v2`) thay vì đổi ngầm response cũ.

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
| Khán giả | `CUSTOMER` hoặc `AUDIENCE` | Xem catalog, đặt vé, xem vé cá nhân. |
| Ban tổ chức | `ORGANIZER` | Quản lý concert, ticket type, thống kê, upload file. |
| Nhân sự soát vé | `CHECKIN_STAFF` hoặc `CHECKER` | Preload dữ liệu, check-in online, sync offline. |
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

## 2. Tổng quan module API

| Module | Prefix | Mục tiêu | Actor chính |
| --- | --- | --- | --- |
| Catalog | `/v1/concerts`, `/v1/admin/concerts` | Xem danh sách/chi tiết concert, metadata, seat map, inventory và quản trị dữ liệu catalog. | Guest, Customer, Organizer, Admin |
| Check-in | `/v1/check-in` | Preload dữ liệu cho mobile, quét QR online, check-in guest, đồng bộ offline. | Check-in Staff, Admin |

---

## 3. Module Catalog API

### 3.1. Mục tiêu

Catalog API phục vụ luồng đọc cực cao cho trang chủ và trang chi tiết concert. Dữ liệu metadata được cache dài qua Redis/CDN, còn số vé còn lại được đọc từ Redis inventory với TTL ngắn/eventual consistency. Không dùng số liệu cache để quyết định bán vé cuối cùng; Ticketing Module vẫn kiểm tra bằng transaction PostgreSQL.

### 3.2. Resource chính

| Resource | Mô tả |
| --- | --- |
| `concert` | Sự kiện/concert. |
| `venue` | Địa điểm tổ chức. |
| `seat_zone` | Khu GA/SVIP/VIP/CAT1/CAT2. |
| `ticket_type` | Loại vé, giá, thời gian bán, giới hạn mỗi user. |
| `artist_bio` | Bio nghệ sĩ đang active để hiển thị. |
| `inventory` | Read model số vé còn lại theo ticket type/zone. |

### 3.3. Endpoint tổng hợp

| Method | Endpoint | Auth | Mục đích |
| --- | --- | --- | --- |
| `GET` | `/concerts` | Public | Danh sách concert published. |
| `GET` | `/concerts/{concert_id}` | Public | Chi tiết concert cho trang detail. |
| `GET` | `/concerts/{concert_id}/metadata` | Public/CDN | Metadata tĩnh, seat zones, active bio, asset URLs. |
| `GET` | `/concerts/{concert_id}/seat-map` | Public/CDN | Sơ đồ SVG/seat map fallback. |
| `GET` | `/concerts/{concert_id}/ticket-types` | Public | Danh sách loại vé đang hiển thị. |
| `GET` | `/concerts/{concert_id}/inventory` | Public | Số vé còn lại gần thời gian thực. |
| `POST` | `/admin/concerts` | `ORGANIZER`, `ADMIN` | Tạo concert. |
| `PATCH` | `/admin/concerts/{concert_id}` | `ORGANIZER`, `ADMIN` | Cập nhật thông tin concert. |
| `POST` | `/admin/concerts/{concert_id}/publish` | `ORGANIZER`, `ADMIN` | Publish concert. |
| `POST` | `/admin/concerts/{concert_id}/cancel` | `ORGANIZER`, `ADMIN` | Hủy concert. |
| `POST` | `/admin/concerts/{concert_id}/seat-zones` | `ORGANIZER`, `ADMIN` | Tạo khu vực chỗ ngồi. |
| `PATCH` | `/admin/seat-zones/{seat_zone_id}` | `ORGANIZER`, `ADMIN` | Cập nhật khu vực. |
| `POST` | `/admin/concerts/{concert_id}/ticket-types` | `ORGANIZER`, `ADMIN` | Tạo loại vé. |
| `PATCH` | `/admin/ticket-types/{ticket_type_id}` | `ORGANIZER`, `ADMIN` | Cập nhật loại vé. |

### 3.4. `GET /concerts`

Trả danh sách concert public cho trang chủ.

**Query parameters**

| Tên | Kiểu | Bắt buộc | Mô tả |
| --- | --- | --- | --- |
| `q` | string | Không | Tìm theo tên concert/nghệ sĩ. |
| `city` | string | Không | Lọc theo thành phố. |
| `from` | datetime | Không | Chỉ lấy concert bắt đầu từ thời điểm này. |
| `to` | datetime | Không | Chỉ lấy concert bắt đầu trước thời điểm này. |
| `status` | string | Không | Public chỉ cho `PUBLISHED`; admin endpoint có thể dùng nhiều status. |
| `limit` | number | Không | Mặc định `20`, tối đa `100`. |
| `cursor` | string | Không | Cursor trang tiếp theo. |
| `sort` | string | Không | `starts_at`, `-starts_at`, `title`. |

**Response `200`**

```json
{
  "data": [
    {
      "id": "crt_01JX9Q2M5P7KZ3R4N8Y6",
      "title": "Anh Trai Say Hi",
      "slug": "anh-trai-say-hi",
      "artist_name": "Various Artists",
      "starts_at": "2026-08-10T12:00:00Z",
      "status": "PUBLISHED",
      "cover_image_url": "https://cdn.ticketbox.vn/concerts/anh-trai-say-hi.webp",
      "venue": {
        "id": "ven_01JX9Q2N",
        "name": "Sân vận động Mỹ Đình",
        "city": "Hà Nội"
      }
    }
  ],
  "pagination": {
    "next_cursor": "eyJzdGFydHNfYXQiOiIyMDI2LTA4LTEwIn0",
    "has_more": true,
    "limit": 20
  },
  "meta": {
    "request_id": "req_01JX9Q6N4E"
  }
}
```

**Cache**

- Redis key: `catalog:list:{hash(query)}`
- TTL: 5-30 phút.
- CDN có thể cache trang/list public nếu query phổ biến.

### 3.5. `GET /concerts/{concert_id}`

Trả chi tiết concert cho web/mobile.

**Response `200`**

```json
{
  "data": {
    "id": "crt_01JX9Q2M5P7KZ3R4N8Y6",
    "title": "Anh Trai Say Hi",
    "slug": "anh-trai-say-hi",
    "description": "Concert âm nhạc quy mô lớn.",
    "artist_name": "Various Artists",
    "starts_at": "2026-08-10T12:00:00Z",
    "ends_at": "2026-08-10T16:00:00Z",
    "status": "PUBLISHED",
    "cover_image_url": "https://cdn.ticketbox.vn/concerts/anh-trai-say-hi.webp",
    "venue": {
      "id": "ven_01JX9Q2N",
      "name": "Sân vận động Mỹ Đình",
      "address": "Lê Đức Thọ, Nam Từ Liêm",
      "city": "Hà Nội",
      "map_url": "https://maps.example/my-dinh"
    },
    "active_artist_bio": {
      "id": "bio_01JX9Q3A",
      "content": "Bản giới thiệu ngắn gọn do AI hỗ trợ biên tập."
    }
  },
  "meta": {
    "request_id": "req_01JX9Q6N4E"
  }
}
```

### 3.6. `GET /concerts/{concert_id}/metadata`

Endpoint tối ưu cho CDN. Trả dữ liệu tĩnh để render trang chi tiết và sơ đồ khu vực.

**Response `200`**

```json
{
  "data": {
    "concert": {
      "id": "crt_01JX9Q2M5P7KZ3R4N8Y6",
      "title": "Anh Trai Say Hi",
      "starts_at": "2026-08-10T12:00:00Z",
      "status": "PUBLISHED"
    },
    "venue": {
      "id": "ven_01JX9Q2N",
      "name": "Sân vận động Mỹ Đình",
      "city": "Hà Nội"
    },
    "seat_zones": [
      {
        "id": "zon_01JX9Q4A",
        "code": "SVIP",
        "name": "SVIP",
        "capacity": 200,
        "svg_path": "M10 10 H120 V80 H10 Z",
        "sort_order": 1
      }
    ],
    "seat_map": {
      "svg_url": "https://cdn.ticketbox.vn/seat-maps/crt_01JX9Q2M.svg",
      "fallback_image_url": "https://cdn.ticketbox.vn/seat-maps/crt_01JX9Q2M.webp"
    },
    "artist_bio": {
      "id": "bio_01JX9Q3A",
      "content": "Bản giới thiệu ngắn gọn."
    }
  },
  "meta": {
    "request_id": "req_01JX9Q6N4E",
    "cache": {
      "source": "redis",
      "ttl_seconds": 86400
    }
  }
}
```

**Headers**

```http
Cache-Control: public, max-age=3600, s-maxage=86400, stale-while-revalidate=3600, stale-if-error=86400
ETag: "catalog-metadata-crt_01JX9Q2M-v7"
```

### 3.7. `GET /concerts/{concert_id}/seat-map`

Trả metadata sơ đồ hoặc redirect tới asset CDN.

**Query parameters**

| Tên | Kiểu | Mô tả |
| --- | --- | --- |
| `format` | `svg`, `json`, `image` | Mặc định `json`. |

**Response `200` với `format=json`**

```json
{
  "data": {
    "concert_id": "crt_01JX9Q2M5P7KZ3R4N8Y6",
    "svg_url": "https://cdn.ticketbox.vn/seat-maps/crt_01JX9Q2M.svg",
    "fallback_image_url": "https://cdn.ticketbox.vn/seat-maps/crt_01JX9Q2M.webp",
    "zones": [
      {
        "seat_zone_id": "zon_01JX9Q4A",
        "code": "SVIP",
        "svg_path": "M10 10 H120 V80 H10 Z"
      }
    ]
  },
  "meta": {
    "request_id": "req_01JX9Q6N4E"
  }
}
```

### 3.8. `GET /concerts/{concert_id}/ticket-types`

Trả danh sách loại vé public.

**Response `200`**

```json
{
  "data": [
    {
      "id": "tkt_01JX9Q5A",
      "concert_id": "crt_01JX9Q2M5P7KZ3R4N8Y6",
      "seat_zone_id": "zon_01JX9Q4A",
      "name": "SVIP",
      "description": "Khu vực gần sân khấu.",
      "price": {
        "amount": 4500000,
        "currency": "VND"
      },
      "max_per_user": 2,
      "sale_start_at": "2026-07-01T03:00:00Z",
      "sale_end_at": "2026-08-09T17:00:00Z",
      "status": "ON_SALE"
    }
  ],
  "meta": {
    "request_id": "req_01JX9Q6N4E"
  }
}
```

### 3.9. `GET /concerts/{concert_id}/inventory`

Trả số vé còn lại gần thời gian thực. Endpoint này tối ưu cho Redis, không query DB ở đường nóng trừ fallback có kiểm soát.

**Response `200`**

```json
{
  "data": {
    "concert_id": "crt_01JX9Q2M5P7KZ3R4N8Y6",
    "as_of": "2026-05-30T10:15:30Z",
    "items": [
      {
        "ticket_type_id": "tkt_01JX9Q5A",
        "seat_zone_id": "zon_01JX9Q4A",
        "zone_code": "SVIP",
        "available_quantity": 118,
        "status": "ON_SALE",
        "display_status": "AVAILABLE"
      },
      {
        "ticket_type_id": "tkt_01JX9Q5B",
        "seat_zone_id": "zon_01JX9Q4B",
        "zone_code": "CAT1",
        "available_quantity": 0,
        "status": "SOLD_OUT",
        "display_status": "SOLD_OUT"
      }
    ]
  },
  "meta": {
    "request_id": "req_01JX9Q6N4E",
    "consistency": "EVENTUAL",
    "cache_ttl_seconds": 5
  }
}
```

**Kịch bản lỗi**

| Trường hợp | HTTP | Code | Hành vi |
| --- | --- | --- | --- |
| Redis inventory lỗi nhưng fallback còn snapshot | `200` | Không có | Trả snapshot kèm `display_status = UPDATING`. |
| Redis lỗi và circuit breaker mở | `503` | `INVENTORY_UNAVAILABLE` | UI hiển thị "Đang cập nhật". |
| Concert không tồn tại/published | `404` | `CONCERT_NOT_FOUND` | Không lộ concert draft cho guest. |

### 3.10. `POST /admin/concerts`

Tạo concert mới ở trạng thái `DRAFT`.

**Request**

```json
{
  "venue_id": "ven_01JX9Q2N",
  "title": "Anh Trai Say Hi",
  "slug": "anh-trai-say-hi",
  "description": "Concert âm nhạc quy mô lớn.",
  "artist_name": "Various Artists",
  "starts_at": "2026-08-10T12:00:00Z",
  "ends_at": "2026-08-10T16:00:00Z",
  "cover_image_url": "https://cdn.ticketbox.vn/concerts/anh-trai-say-hi.webp"
}
```

**Response `201`**

```json
{
  "data": {
    "id": "crt_01JX9Q2M5P7KZ3R4N8Y6",
    "status": "DRAFT"
  },
  "meta": {
    "request_id": "req_01JX9Q6N4E"
  }
}
```

**Ràng buộc**

- `ends_at` phải lớn hơn `starts_at`.
- `slug` unique.
- Người gọi phải là organizer của concert hoặc `ADMIN` khi cập nhật về sau.
- Sau khi update/publish/cancel phải invalidate `catalog:list`, `catalog:concert:{id}`, `catalog:metadata:{id}`.

### 3.11. `POST /admin/concerts/{concert_id}/ticket-types`

Tạo loại vé và cấu hình giới hạn mỗi user.

**Request**

```json
{
  "seat_zone_id": "zon_01JX9Q4A",
  "name": "SVIP",
  "description": "Khu vực gần sân khấu.",
  "price": {
    "amount": 4500000,
    "currency": "VND"
  },
  "total_quantity": 200,
  "max_per_user": 2,
  "sale_start_at": "2026-07-01T03:00:00Z",
  "sale_end_at": "2026-08-09T17:00:00Z"
}
```

**Response `201`**

```json
{
  "data": {
    "id": "tkt_01JX9Q5A",
    "status": "DRAFT",
    "available_quantity": 200,
    "held_quantity": 0,
    "sold_quantity": 0
  },
  "meta": {
    "request_id": "req_01JX9Q6N4E"
  }
}
```

**Ràng buộc**

- `total_quantity <= seat_zone.capacity`.
- `max_per_user > 0`.
- `sale_end_at > sale_start_at`.
- Cập nhật số lượng sau khi đã bán vé phải đi qua nghiệp vụ inventory adjustment, không sửa trực tiếp bừa bãi.

---

## 4. Module Check-in API

### 4.1. Mục tiêu

Check-in API phục vụ mobile app tại cổng vào. Module phải hoạt động an toàn khi online và khi mất mạng:

- Online scan: server xác thực QR, device, concert, gate-zone và cập nhật trạng thái vé trong transaction.
- Offline preload: mobile tải trước danh sách vé/guest hợp lệ, allowed zones và public key/signature metadata.
- Offline sync: mobile gửi batch scan lên server khi có mạng lại, xử lý idempotent bằng `batch_token`.
- Guest VIP: hỗ trợ check-in guest từ `guest_list`, vẫn phải kiểm tra đúng concert và đúng gate-zone.

### 4.2. Resource chính

| Resource | Mô tả |
| --- | --- |
| `checkin_device` | Thiết bị mobile được gán staff, concert và gate. |
| `checkin_gate` | Cổng soát vé của concert. |
| `checkin_gate_zone` | Mapping cổng và khu được phép vào. |
| `checkin_scan` | Một lần quét online. |
| `offline_checkin_batch` | Một batch sync offline từ thiết bị. |
| `offline_checkin_item` | Một item scan trong batch. |
| `guest_checkin` | Lượt check-in khách mời VIP. |

### 4.3. Endpoint tổng hợp

| Method | Endpoint | Auth | Mục đích |
| --- | --- | --- | --- |
| `GET` | `/check-in/devices/{device_id}/bootstrap` | `CHECKIN_STAFF`, `ADMIN` | Lấy cấu hình thiết bị, concert, gate, allowed zones. |
| `GET` | `/check-in/preload` | `CHECKIN_STAFF`, `ADMIN` | Tải dữ liệu offline cho thiết bị/cổng. |
| `POST` | `/check-in/scans` | `CHECKIN_STAFF`, `ADMIN` | Quét vé online bằng QR. |
| `POST` | `/check-in/guests/scans` | `CHECKIN_STAFF`, `ADMIN` | Check-in guest VIP online. |
| `POST` | `/check-in/offline-batches` | `CHECKIN_STAFF`, `ADMIN` | Tạo hoặc lấy batch sync offline theo `batch_token`. |
| `POST` | `/check-in/offline-batches/{batch_id}/items` | `CHECKIN_STAFF`, `ADMIN` | Gửi item scan offline vào batch. |
| `POST` | `/check-in/offline-batches/{batch_id}/complete` | `CHECKIN_STAFF`, `ADMIN` | Chốt batch, cập nhật summary. |
| `GET` | `/check-in/offline-batches/{batch_id}` | `CHECKIN_STAFF`, `ADMIN` | Xem trạng thái sync batch. |
| `GET` | `/admin/concerts/{concert_id}/check-in/gates` | `ORGANIZER`, `ADMIN` | Danh sách cổng check-in. |
| `POST` | `/admin/concerts/{concert_id}/check-in/gates` | `ORGANIZER`, `ADMIN` | Tạo cổng check-in. |
| `PUT` | `/admin/check-in/gates/{gate_id}/zones` | `ORGANIZER`, `ADMIN` | Cấu hình mapping gate-zone. |
| `POST` | `/admin/check-in/devices` | `ORGANIZER`, `ADMIN` | Đăng ký thiết bị soát vé. |

### 4.4. `GET /check-in/devices/{device_id}/bootstrap`

Mobile gọi sau khi checker đăng nhập để lấy cấu hình vận hành hiện tại.

**Headers**

```http
Authorization: Bearer <jwt>
X-Device-Id: dev_01JX9Q7A
```

**Response `200`**

```json
{
  "data": {
    "device": {
      "id": "dev_01JX9Q7A",
      "status": "ACTIVE",
      "staff_id": "usr_01JX9Q8B",
      "last_sync_at": "2026-05-30T09:00:00Z"
    },
    "concert": {
      "id": "crt_01JX9Q2M5P7KZ3R4N8Y6",
      "title": "Anh Trai Say Hi",
      "starts_at": "2026-08-10T12:00:00Z"
    },
    "gate": {
      "id": "gat_01JX9Q9C",
      "code": "SVIP_GATE",
      "name": "Cổng SVIP",
      "is_active": true
    },
    "allowed_seat_zones": [
      {
        "id": "zon_01JX9Q4A",
        "code": "SVIP",
        "name": "SVIP"
      }
    ],
    "qr_verification": {
      "algorithm": "Ed25519",
      "public_key_id": "key_2026_01",
      "public_key": "base64-public-key"
    }
  },
  "meta": {
    "request_id": "req_01JX9Q6N4E"
  }
}
```

**Lỗi**

| Trường hợp | HTTP | Code |
| --- | --- | --- |
| Device không tồn tại | `404` | `DEVICE_NOT_FOUND` |
| Device `REVOKED` hoặc `LOST` | `403` | `DEVICE_REVOKED` |
| Staff không được gán device | `403` | `DEVICE_FORBIDDEN` |
| Gate inactive | `409` | `GATE_INACTIVE` |

### 4.5. `GET /check-in/preload`

Tải snapshot tối thiểu để mobile có thể check-in offline.

**Query parameters**

| Tên | Kiểu | Bắt buộc | Mô tả |
| --- | --- | --- | --- |
| `concert_id` | string | Có | Concert cần tải. |
| `gate_id` | string | Có | Cổng hiện tại của thiết bị. |
| `device_id` | string | Có | Thiết bị tải dữ liệu. |
| `include_guests` | boolean | Không | Có tải guest list hợp lệ hay không. |
| `cursor` | string | Không | Dùng nếu danh sách vé/guest lớn. |
| `limit` | number | Không | Mặc định `1000`, tối đa do server cấu hình. |

**Response `200`**

```json
{
  "data": {
    "snapshot_id": "snap_01JX9QAB",
    "concert_id": "crt_01JX9Q2M5P7KZ3R4N8Y6",
    "gate_id": "gat_01JX9Q9C",
    "device_id": "dev_01JX9Q7A",
    "generated_at": "2026-05-30T10:15:30Z",
    "allowed_seat_zone_ids": ["zon_01JX9Q4A"],
    "tickets": [
      {
        "ticket_id": "tic_01JX9QC1",
        "concert_id": "crt_01JX9Q2M5P7KZ3R4N8Y6",
        "ticket_type_id": "tkt_01JX9Q5A",
        "seat_zone_id": "zon_01JX9Q4A",
        "qr_token_hash": "sha256:8b4f...",
        "qr_signature": "base64-signature",
        "status_snapshot": "ISSUED"
      }
    ],
    "guests": [
      {
        "guest_id": "gst_01JX9QD2",
        "concert_id": "crt_01JX9Q2M5P7KZ3R4N8Y6",
        "seat_zone_id": "zon_01JX9Q4A",
        "phone_masked": "******789",
        "full_name": "Nguyen Van A",
        "status_snapshot": "INVITED"
      }
    ]
  },
  "pagination": {
    "next_cursor": null,
    "has_more": false,
    "limit": 1000
  },
  "meta": {
    "request_id": "req_01JX9Q6N4E"
  }
}
```

**Ràng buộc**

- Chỉ trả ticket/guest thuộc `allowed_seat_zone_ids` của gate.
- Không trả dữ liệu nhạy cảm đầy đủ nếu không cần; ưu tiên hash QR và thông tin đã mask.
- Response phải có thể phân trang vì concert lớn có thể có hàng chục nghìn vé.
- `Cache-Control: no-store` vì dữ liệu check-in nhạy cảm.

### 4.6. `POST /check-in/scans`

Quét vé online. Đây là endpoint quyết định trạng thái cuối cùng của vé khi có mạng.

**Request**

```json
{
  "concert_id": "crt_01JX9Q2M5P7KZ3R4N8Y6",
  "device_id": "dev_01JX9Q7A",
  "gate_id": "gat_01JX9Q9C",
  "qr_token": "qr_live_token_or_signed_payload",
  "scanned_at": "2026-08-10T11:30:00Z"
}
```

**Response `200` khi thành công**

```json
{
  "data": {
    "result": "SUCCESS",
    "message": "Vé hợp lệ.",
    "ticket": {
      "id": "tic_01JX9QC1",
      "concert_id": "crt_01JX9Q2M5P7KZ3R4N8Y6",
      "seat_zone_id": "zon_01JX9Q4A",
      "zone_code": "SVIP",
      "status": "CHECKED_IN",
      "checked_in_at": "2026-08-10T11:30:01Z"
    },
    "gate": {
      "id": "gat_01JX9Q9C",
      "code": "SVIP_GATE"
    },
    "log_id": "log_01JX9QF3"
  },
  "meta": {
    "request_id": "req_01JX9Q6N4E"
  }
}
```

**Response `409` khi đã check-in**

```json
{
  "type": "https://api.ticketbox.vn/errors/already-checked-in",
  "title": "Vé đã được sử dụng",
  "status": 409,
  "code": "ALREADY_CHECKED_IN",
  "detail": "Vé này đã check-in trước đó.",
  "instance": "/v1/check-in/scans",
  "request_id": "req_01JX9Q6N4E"
}
```

**Luồng xử lý bắt buộc**

1. Verify JWT role `CHECKIN_STAFF` hoặc `ADMIN`.
2. Kiểm tra device tồn tại, `status = ACTIVE`, thuộc staff hiện tại.
3. Kiểm tra gate thuộc concert và `is_active = TRUE`.
4. Verify QR signature/token.
5. Tìm ticket theo QR.
6. Kiểm tra ticket thuộc đúng concert.
7. Kiểm tra `ticket.status = ISSUED`.
8. Kiểm tra `ticket.seat_zone_id` nằm trong mapping `checkin_gate_zones` của `gate_id`.
9. Trong transaction, update ticket thành `CHECKED_IN` và ghi `checkin_logs`.
10. Nếu lỗi nghiệp vụ, không update ticket nhưng vẫn ghi log scan với result tương ứng.

**Mã kết quả nghiệp vụ**

| Result | HTTP | Ý nghĩa |
| --- | --- | --- |
| `SUCCESS` | `200` | Check-in thành công. |
| `INVALID_TICKET` | `404` hoặc `422` | QR không tồn tại, sai chữ ký hoặc không resolve được. |
| `ALREADY_CHECKED_IN` | `409` | Vé đã dùng. |
| `WRONG_CONCERT` | `409` | Vé thuộc concert khác. |
| `WRONG_GATE` | `409` | Vé đúng concert nhưng sai cổng/khu. |
| `CONFLICT` | `409` | Hai thiết bị/cổng xử lý cùng lúc, server phát hiện xung đột. |
| `ERROR` | `500` | Lỗi không mong muốn. |

### 4.7. `POST /check-in/guests/scans`

Check-in khách mời VIP online.

**Request**

```json
{
  "concert_id": "crt_01JX9Q2M5P7KZ3R4N8Y6",
  "device_id": "dev_01JX9Q7A",
  "gate_id": "gat_01JX9Q9C",
  "guest_id": "gst_01JX9QD2",
  "phone": "+84901234789",
  "scanned_at": "2026-08-10T11:35:00Z"
}
```

`guest_id` được ưu tiên nếu có. Nếu không có, server tìm guest theo `(concert_id, phone)`.

**Response `200`**

```json
{
  "data": {
    "result": "SUCCESS",
    "message": "Khách mời hợp lệ.",
    "guest": {
      "id": "gst_01JX9QD2",
      "full_name": "Nguyen Van A",
      "seat_zone_id": "zon_01JX9Q4A",
      "zone_code": "SVIP",
      "status": "CHECKED_IN",
      "checked_in_at": "2026-08-10T11:35:01Z"
    },
    "log_id": "log_01JX9QF4"
  },
  "meta": {
    "request_id": "req_01JX9Q6N4E"
  }
}
```

**Ràng buộc**

- Guest phải thuộc đúng concert.
- Guest có `seat_zone_id` thì bắt buộc đúng gate-zone.
- Guest `CANCELLED` hoặc đã `CHECKED_IN` bị từ chối.
- Guest không có `seat_zone_id` mặc định không cho offline check-in; online chỉ admin/organizer cấu hình fallback rõ ràng mới được phép.

### 4.8. `POST /check-in/offline-batches`

Tạo hoặc lấy lại batch sync offline. Endpoint này idempotent theo `batch_token`.

**Headers**

```http
Idempotency-Key: 7f93b7c2-17f0-45fd-90aa-093a9b41d207
```

**Request**

```json
{
  "batch_token": "batch_dev_01JX9Q7A_20260810_0001",
  "concert_id": "crt_01JX9Q2M5P7KZ3R4N8Y6",
  "device_id": "dev_01JX9Q7A",
  "gate_id": "gat_01JX9Q9C",
  "started_at": "2026-08-10T11:00:00Z",
  "ended_at": "2026-08-10T12:00:00Z"
}
```

**Response `201` hoặc `200` nếu batch đã tồn tại**

```json
{
  "data": {
    "id": "bat_01JX9QH5",
    "batch_token": "batch_dev_01JX9Q7A_20260810_0001",
    "status": "SYNCING",
    "item_count": 0,
    "accepted_count": 0,
    "conflict_count": 0,
    "invalid_count": 0
  },
  "meta": {
    "request_id": "req_01JX9Q6N4E",
    "idempotent_replay": false
  }
}
```

**Ràng buộc**

- `batch_token` unique.
- Device phải `ACTIVE`.
- `gate_id` phải là cổng của device hoặc cổng được server cho phép.
- Gate phải active và thuộc concert.

### 4.9. `POST /check-in/offline-batches/{batch_id}/items`

Gửi một hoặc nhiều item offline để server validate lại.

**Request**

```json
{
  "items": [
    {
      "client_item_id": "local_scan_0001",
      "type": "TICKET",
      "qr_token": "qr_live_token_or_signed_payload",
      "ticket_id": "tic_01JX9QC1",
      "guest_id": null,
      "concert_id": "crt_01JX9Q2M5P7KZ3R4N8Y6",
      "gate_id": "gat_01JX9Q9C",
      "seat_zone_id": "zon_01JX9Q4A",
      "local_result": "SUCCESS",
      "local_scanned_at": "2026-08-10T11:20:00Z"
    },
    {
      "client_item_id": "local_scan_0002",
      "type": "GUEST",
      "qr_token": null,
      "ticket_id": null,
      "guest_id": "gst_01JX9QD2",
      "concert_id": "crt_01JX9Q2M5P7KZ3R4N8Y6",
      "gate_id": "gat_01JX9Q9C",
      "seat_zone_id": "zon_01JX9Q4A",
      "local_result": "SUCCESS",
      "local_scanned_at": "2026-08-10T11:22:00Z"
    }
  ]
}
```

**Response `200`**

```json
{
  "data": {
    "batch_id": "bat_01JX9QH5",
    "results": [
      {
        "client_item_id": "local_scan_0001",
        "server_item_id": "ofi_01JX9QI6",
        "sync_result": "ACCEPTED",
        "ticket_id": "tic_01JX9QC1",
        "guest_id": null,
        "reason": null,
        "log_id": "log_01JX9QF5"
      },
      {
        "client_item_id": "local_scan_0002",
        "server_item_id": "ofi_01JX9QI7",
        "sync_result": "CONFLICT",
        "ticket_id": null,
        "guest_id": "gst_01JX9QD2",
        "reason": "Guest đã được check-in trước đó.",
        "log_id": "log_01JX9QF6"
      }
    ]
  },
  "meta": {
    "request_id": "req_01JX9Q6N4E"
  }
}
```

**Sync result**

| Result | Ý nghĩa |
| --- | --- |
| `ACCEPTED` | Server chấp nhận và cập nhật source of truth. |
| `CONFLICT` | Vé/guest đã check-in bởi lượt khác. |
| `INVALID` | QR/guest/ticket không hợp lệ hoặc không resolve được. |
| `WRONG_GATE` | Sai cổng/khu so với mapping server. |
| `ERROR` | Lỗi xử lý item, có thể retry. |

**Luồng xử lý mỗi item**

1. Kiểm tra batch đang `SYNCING`.
2. Kiểm tra item chưa xử lý trước đó theo `(batch_id, client_item_id)`.
3. Verify device/gate/concert.
4. Resolve ticket hoặc guest.
5. Kiểm tra đúng concert.
6. Kiểm tra gate-zone bằng dữ liệu PostgreSQL, không tin tuyệt đối local result.
7. Nếu hợp lệ và chưa check-in, update `tickets` hoặc `guest_list`.
8. Ghi `offline_checkin_items` và `checkin_logs`.
9. Trả kết quả từng item để mobile cập nhật SQLite local.

### 4.10. `POST /check-in/offline-batches/{batch_id}/complete`

Chốt batch sau khi gửi hết item.

**Request**

```json
{
  "client_summary": {
    "item_count": 250,
    "success_count": 245,
    "wrong_gate_count": 3,
    "invalid_count": 2
  }
}
```

**Response `200`**

```json
{
  "data": {
    "id": "bat_01JX9QH5",
    "status": "DONE",
    "item_count": 250,
    "accepted_count": 244,
    "conflict_count": 1,
    "wrong_gate_count": 3,
    "invalid_count": 2,
    "completed_at": "2026-08-10T12:05:00Z"
  },
  "meta": {
    "request_id": "req_01JX9Q6N4E"
  }
}
```

### 4.11. Admin Check-in configuration

#### `POST /admin/concerts/{concert_id}/check-in/gates`

Tạo cổng soát vé.

```json
{
  "code": "SVIP_GATE",
  "name": "Cổng SVIP",
  "is_active": true
}
```

#### `PUT /admin/check-in/gates/{gate_id}/zones`

Cấu hình cổng được nhận khu nào.

```json
{
  "seat_zone_ids": ["zon_01JX9Q4A"]
}
```

Response:

```json
{
  "data": {
    "gate_id": "gat_01JX9Q9C",
    "seat_zone_ids": ["zon_01JX9Q4A"],
    "updated_at": "2026-05-30T10:15:30Z"
  },
  "meta": {
    "request_id": "req_01JX9Q6N4E"
  }
}
```

#### `POST /admin/check-in/devices`

Đăng ký thiết bị soát vé.

```json
{
  "device_name": "Scanner SVIP 01",
  "staff_id": "usr_01JX9Q8B",
  "concert_id": "crt_01JX9Q2M5P7KZ3R4N8Y6",
  "gate_id": "gat_01JX9Q9C"
}
```

### 4.12. Ràng buộc bảo mật và nhất quán của Check-in

- Check-in API luôn `Cache-Control: no-store`.
- Mobile không được tự quyết định source of truth cuối cùng; offline chỉ là local acceptance tạm thời.
- Server phải kiểm tra lại gate-zone cho cả ticket và guest.
- Một vé chỉ được chuyển `ISSUED -> CHECKED_IN` một lần.
- Một guest chỉ được chuyển `INVITED -> CHECKED_IN` một lần.
- Mọi scan phải có log với staff, device, gate, zone, time, result.
- Offline retry phải dùng lại `batch_token` và `client_item_id` để không tạo item trùng.
- Nếu hai batch offline cùng chứa một vé, batch xử lý sau phải nhận `CONFLICT`.

