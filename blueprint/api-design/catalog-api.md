# TicketBox — Catalog API Design

Tài liệu này thiết kế API cho **Catalog Module**. Module này phục vụ hai nhóm nhu cầu:

- Public read cực cao cho trang danh sách concert, trang chi tiết, metadata, seat map và số vé còn lại.
- Admin/Organizer quản lý dữ liệu catalog: venue, concert, seat zone, ticket type và trạng thái xuất bản.

Catalog API phải đồng bộ với:

- `blueprint/specs/09-concert-catalog.md`
- `blueprint/specs/14-caching.md`
- `blueprint/specs/15-rate-limiting-anti-bot.md`
- `blueprint/database-design.md`
- quy ước chung trong `blueprint/api-design/base-api.md`

---

## 1. Mục tiêu

Catalog là module chịu tải đọc lớn nhất của TicketBox, đặc biệt trong các phút đầu mở bán khi nhiều người dùng cùng vào trang chủ hoặc trang chi tiết concert.

Mục tiêu kỹ thuật:

- Trang danh sách và chi tiết concert không truy vấn trực tiếp PostgreSQL ở mọi request.
- Metadata tĩnh được cache dài qua Redis/CDN.
- Seat map/SVG và ảnh fallback được phục vụ qua CDN/Object Storage.
- Số vé còn lại được đọc từ Redis inventory read model với TTL ngắn.
- UI chấp nhận eventual consistency cho số vé hiển thị; quyết định bán vé cuối cùng vẫn thuộc Ticketing Module bằng transaction PostgreSQL.
- Khi origin/Redis lỗi, hệ thống graceful degradation thay vì làm trắng trang.

---

## 2. Base URL và chuẩn response

| Môi trường | Base URL | Ghi chú |
| --- | --- | --- |
| API Gateway | `https://api.ticketbox.vn/v1` | Public dynamic API và admin API. |
| CDN Metadata | `https://cdn.ticketbox.vn/api/v1` | Metadata tĩnh, seat map metadata, asset URLs. |
| Local | `http://localhost:3000/v1` | Chạy backend local. |

Tất cả response JSON dùng envelope:

```json
{
  "data": {},
  "meta": {
    "request_id": "req_01JX9Q6N4E"
  }
}
```

Danh sách có pagination:

```json
{
  "data": [],
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

Lỗi dùng RFC 7807:

```json
{
  "type": "https://api.ticketbox.vn/errors/concert-not-found",
  "title": "Concert không tồn tại",
  "status": 404,
  "code": "CONCERT_NOT_FOUND",
  "detail": "Concert không tồn tại hoặc chưa được công bố.",
  "instance": "/v1/concerts/crt_01JX9Q2M5P7KZ3R4N8Y6",
  "request_id": "req_01JX9Q6N4E"
}
```

---

## 3. Domain model và mapping database

| API resource | Bảng chính | Vai trò |
| --- | --- | --- |
| `venue` | `venues` | Địa điểm tổ chức concert. |
| `concert` | `concerts` | Sự kiện/concert, trạng thái `DRAFT/PUBLISHED/CANCELLED/COMPLETED`. |
| `seat_zone` | `seat_zones` | Khu vực GA/SVIP/VIP/CAT1/CAT2 và metadata SVG. |
| `ticket_type` | `ticket_types` | Loại vé, giá, sale window, tồn kho, giới hạn mỗi user. |
| `artist_bio` | `concerts.artist_bio` | Bio được hiển thị trên trang chi tiết. |
| `inventory` | `ticket_types` + Redis read model | Số vé còn lại gần thời gian thực. |

Trường database quan trọng cần phản ánh trong API:

- `venues`: `id`, `name`, `address`, `city`, `capacity`, `map_url`.
- `concerts`: `id`, `venue_id`, `organizer_id`, `title`, `slug`, `description`, `artist_name`, `artist_bio`, `starts_at`, `ends_at`, `planned_publish_at`, `status`, `cover_image_url`, `seat_map_url`. `planned_publish_at` (nullable) lấy từ hồ sơ `organizer_requests` khi admin duyệt.
- `seat_zones`: `id`, `concert_id`, `code`, `name`, `description`, `capacity`, `svg_path`, `sort_order`.
- `ticket_types`: `id`, `concert_id`, `seat_zone_id`, `name`, `description`, `price`, `currency`, `total_quantity`, `held_quantity`, `sold_quantity`, `max_per_user`, `sale_start_at`, `sale_end_at`, `status`. API có thể trả `available_quantity` như computed field, không phải cột DB.

Public API không trả các field vận hành nhạy cảm nếu không cần, ví dụ `organizer_id`, `held_quantity`, audit hoặc internal counters. `available_quantity` nếu trả về phải được tính từ `total_quantity - held_quantity - sold_quantity` hoặc lấy từ Redis read model đã đồng bộ từ công thức này.

---

## 4. RBAC

| Nhóm endpoint | Auth | Quyền |
| --- | --- | --- |
| Public catalog read | Không bắt buộc JWT | Guest và AUDIENCE đều xem được concert `PUBLISHED`. |
| Public inventory | Không bắt buộc JWT | Bị rate limit theo IP + concert. |
| Admin catalog | `ADMIN` | Admin toàn quyền với concert: list (kể cả `DRAFT`/`CANCELLED`/`COMPLETED`), sửa, publish, cancel. |

Backend vẫn phải kiểm tra ownership sau API Gateway. Không chỉ dựa vào role trong JWT. **Sprint 6:** route catalog admin chỉ còn `ADMIN`; BTC quản lý concert của mình qua `/organizer/*` (xem `organizer-api.md`), còn việc tạo venue/zone/ticket-type chuyển vào luồng duyệt hồ sơ tổ chức (xem `organizer-admin-api.md`).

---

## 5. Endpoint tổng hợp

### 5.1. Public endpoints

| Method | Endpoint | Auth | Mục đích |
| --- | --- | --- | --- |
| `GET` | `/concerts` | Public | Danh sách concert `PUBLISHED`. |
| `GET` | `/concerts/{concert_id}` | Public | Chi tiết concert cho trang detail. |
| `GET` | `/concerts/{concert_id}/metadata` | Public/CDN | Metadata tĩnh, venue, zones, bio, asset URLs. |
| `GET` | `/concerts/{concert_id}/seat-map` | Public/CDN | Sơ đồ SVG hoặc metadata seat map. |
| `GET` | `/concerts/{concert_id}/ticket-types` | Public | Danh sách loại vé được hiển thị. |
| `GET` | `/concerts/{concert_id}/inventory` | Public | Tồn kho gần thời gian thực từ Redis. |

### 5.2. Admin endpoints

| Method | Endpoint | Auth | Mục đích |
| --- | --- | --- | --- |
| `GET` | `/admin/concerts` | `ADMIN` | Danh sách concert quản trị, có cả draft/cancelled. |
| `PATCH` | `/admin/concerts/{concert_id}` | `ADMIN` | Cập nhật concert. |
| `POST` | `/admin/concerts/{concert_id}/publish` | `ADMIN` | Publish concert. |
| `POST` | `/admin/concerts/{concert_id}/cancel` | `ADMIN` | Hủy concert. |

> **Sprint 6 (bỏ route, trả `404`):** `GET/POST /admin/venues`, `PATCH /admin/venues/{id}`, `POST /admin/concerts`, `POST /admin/concerts/{id}/seat-zones`, `PATCH /admin/seat-zones/{id}`, `POST /admin/concerts/{id}/ticket-types`, `PATCH /admin/ticket-types/{id}`. Venue/zone/ticket-type nay tạo trong luồng admin duyệt hồ sơ tổ chức (xem `organizer-admin-api.md`); BTC chọn venue qua `GET /organizer/venues`. **Giữ** method trong controller/service để luồng approve tái dùng.

---

## 6. Public API chi tiết

### 6.1. `GET /concerts`

Trả danh sách concert công khai cho trang chủ/search.

**Query parameters**

| Tên | Kiểu | Bắt buộc | Mô tả |
| --- | --- | --- | --- |
| `q` | string | Không | Tìm theo `title` hoặc `artist_name`. |
| `city` | string | Không | Lọc theo `venues.city`. |
| `from` | datetime | Không | Chỉ lấy concert bắt đầu từ thời điểm này. |
| `to` | datetime | Không | Chỉ lấy concert bắt đầu trước thời điểm này. |
| `limit` | number | Không | Mặc định `20`, tối đa `100`. |
| `cursor` | string | Không | Cursor trang tiếp theo. |
| `sort` | string | Không | `starts_at`, `-starts_at`, `title`. |

Public endpoint luôn ép `concerts.status = PUBLISHED`. Nếu client gửi `status`, server bỏ qua hoặc trả `400` tùy policy triển khai.

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
      "ends_at": "2026-08-10T16:00:00Z",
      "status": "PUBLISHED",
      "cover_image_url": "https://cdn.ticketbox.vn/concerts/anh-trai-say-hi.webp",
      "venue": {
        "id": "ven_01JX9Q2N",
        "name": "Sân vận động Mỹ Đình",
        "city": "Hà Nội"
      },
      "ticket_price_range": {
        "min_amount": 500000,
        "max_amount": 4500000,
        "currency": "VND"
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
- TTL: `5-30 phút`
- Header gợi ý: `Cache-Control: public, s-maxage=300, stale-while-revalidate=600`
- Với query phổ biến, CDN có thể cache.

---

### 6.2. `GET /concerts/{concert_id}`

Trả chi tiết concert cho web/mobile. Endpoint này thuận tiện cho client app; page render nặng nên ưu tiên gọi thêm `/metadata` và `/inventory` song song.

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
    "artist_bio": "Bản giới thiệu ngắn gọn do AI hỗ trợ biên tập."
  },
  "meta": {
    "request_id": "req_01JX9Q6N4E"
  }
}
```

**Ràng buộc**

- Guest chỉ xem được `PUBLISHED`.
- Nếu concert là `DRAFT` hoặc không thuộc quyền của caller, trả `404 CONCERT_NOT_FOUND` thay vì lộ dữ liệu.
- Admin cần xem draft dùng `/admin/concerts/{concert_id}` nếu endpoint đó được bổ sung ở phase sau.

---

### 6.3. `GET /concerts/{concert_id}/metadata`

Endpoint tối ưu cho CDN. Trả dữ liệu tĩnh để render trang chi tiết, seat zones và artist bio.

**Response `200`**

```json
{
  "data": {
    "concert": {
      "id": "crt_01JX9Q2M5P7KZ3R4N8Y6",
      "title": "Anh Trai Say Hi",
      "slug": "anh-trai-say-hi",
      "description": "Concert âm nhạc quy mô lớn.",
      "artist_name": "Various Artists",
      "starts_at": "2026-08-10T12:00:00Z",
      "ends_at": "2026-08-10T16:00:00Z",
      "status": "PUBLISHED",
      "cover_image_url": "https://cdn.ticketbox.vn/concerts/anh-trai-say-hi.webp"
    },
    "venue": {
      "id": "ven_01JX9Q2N",
      "name": "Sân vận động Mỹ Đình",
      "address": "Lê Đức Thọ, Nam Từ Liêm",
      "city": "Hà Nội",
      "map_url": "https://maps.example/my-dinh"
    },
    "seat_zones": [
      {
        "id": "zon_01JX9Q4A",
        "code": "SVIP",
        "name": "SVIP",
        "description": "Khu vực gần sân khấu.",
        "capacity": 200,
        "svg_path": "M10 10 H120 V80 H10 Z",
        "sort_order": 1
      }
    ],
    "ticket_types": [
      {
        "id": "tkt_01JX9Q5A",
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
    "seat_map": {
      "svg_url": "https://cdn.ticketbox.vn/seat-maps/crt_01JX9Q2M.svg",
      "fallback_image_url": "https://cdn.ticketbox.vn/seat-maps/crt_01JX9Q2M.webp"
    },
    "artist_bio": "Bản giới thiệu ngắn gọn."
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

**Cache behavior**

- CDN cache hit phải trả trực tiếp từ edge.
- Cache miss về origin phải dùng SingleFlight để tránh nhiều request cùng đập vào DB.
- Khi admin update concert, venue, zone, ticket type hoặc active bio, backend phải purge/invalidate:
  - `catalog:concert:{concert_id}`
  - `catalog:metadata:{concert_id}`
  - `catalog:list:*`
  - CDN URL `/api/v1/concerts/{concert_id}/metadata`

---

### 6.4. `GET /concerts/{concert_id}/seat-map`

Trả metadata sơ đồ hoặc redirect tới asset CDN.

**Query parameters**

| Tên | Kiểu | Bắt buộc | Mô tả |
| --- | --- | --- | --- |
| `format` | `json`, `svg`, `image` | Không | Mặc định `json`. |

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
        "name": "SVIP",
        "svg_path": "M10 10 H120 V80 H10 Z",
        "sort_order": 1
      }
    ]
  },
  "meta": {
    "request_id": "req_01JX9Q6N4E"
  }
}
```

**Response với `format=svg` hoặc `format=image`**

- Có thể trả `302` tới CDN asset.
- Header asset nên là `Cache-Control: public, max-age=31536000, immutable`.

---

### 6.5. `GET /concerts/{concert_id}/ticket-types`

Trả danh sách loại vé public cho concert.

**Query parameters**

| Tên | Kiểu | Bắt buộc | Mô tả |
| --- | --- | --- | --- |
| `include_closed` | boolean | Không | Mặc định `false`; nếu `true` vẫn trả loại vé đã `CLOSED/SOLD_OUT` để UI hiển thị. |

**Response `200`**

```json
{
  "data": [
    {
      "id": "tkt_01JX9Q5A",
      "concert_id": "crt_01JX9Q2M5P7KZ3R4N8Y6",
      "seat_zone_id": "zon_01JX9Q4A",
      "zone_code": "SVIP",
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

**Cache**

- Redis key: `catalog:ticket-types:{concert_id}:{include_closed}`
- TTL: `5-30 phút`
- Invalidate khi admin tạo/cập nhật ticket type hoặc publish/cancel concert.

---

### 6.6. `GET /concerts/{concert_id}/inventory`

Trả số vé còn lại gần thời gian thực. Endpoint này đọc Redis ở đường nóng, không dùng PostgreSQL để phục vụ request bình thường.

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

**Redis model gợi ý**

```text
inventory:concert:{concert_id}
  ticket_type:{ticket_type_id}:available_quantity_computed
  ticket_type:{ticket_type_id}:status
  ticket_type:{ticket_type_id}:updated_at
```

Hoặc dùng Redis Hash:

```text
HGETALL inventory:concert:{concert_id}
```

**Display status**

| Điều kiện | `display_status` |
| --- | --- |
| `available_quantity > low_stock_threshold` và đang mở bán | `AVAILABLE` |
| `0 < available_quantity <= low_stock_threshold` | `LOW_STOCK` |
| `available_quantity = 0` hoặc `status = SOLD_OUT` | `SOLD_OUT` |
| Ngoài sale window hoặc `status = CLOSED` | `CLOSED` |
| Redis fallback snapshot cũ | `UPDATING` |

**Kịch bản lỗi**

| Trường hợp | HTTP | Code | Hành vi |
| --- | --- | --- | --- |
| Redis inventory lỗi nhưng fallback còn snapshot | `200` | Không có | Trả snapshot và set `display_status = UPDATING`. |
| Redis lỗi và circuit breaker mở | `503` | `INVENTORY_UNAVAILABLE` | UI hiển thị "Đang cập nhật". |
| Concert không tồn tại hoặc chưa published | `404` | `CONCERT_NOT_FOUND` | Không lộ concert draft cho guest. |

**Rate limit**

- Key: `rate:inventory:{ip}:{concert_id}`
- Gợi ý: `120 requests/phút`
- Response khi vượt ngưỡng: `429 RATE_LIMITED` kèm `Retry-After`.

---

## 7. Admin API chi tiết

> **Sprint 6 — các mục đã bỏ khỏi catalog (trả `404`):** §7.1–§7.3 (venues), §7.5 (`POST /admin/concerts`), §7.9–§7.10 (seat-zones), §7.11–§7.12 (ticket-types). Việc tạo venue/zone/ticket-type chuyển vào luồng admin duyệt hồ sơ tổ chức (xem `organizer-admin-api.md`); BTC chọn venue qua `GET /organizer/venues`. Các mục đó giữ làm tham chiếu. **Còn hoạt động** (guard `ADMIN`): §7.4 (`GET /admin/concerts`), §7.6 (`PATCH /admin/concerts/{id}`), §7.7 (`publish`), §7.8 (`cancel`).

### 7.1. `GET /admin/venues`

Trả danh sách venue để Organizer/Admin chọn khi tạo concert.

**Query parameters**

| Tên | Kiểu | Bắt buộc | Mô tả |
| --- | --- | --- | --- |
| `q` | string | Không | Tìm theo tên venue hoặc địa chỉ. |
| `city` | string | Không | Lọc theo thành phố. |
| `limit` | number | Không | Mặc định `20`, tối đa `100`. |
| `cursor` | string | Không | Cursor trang tiếp theo. |

**Response `200`**

```json
{
  "data": [
    {
      "id": "ven_01JX9Q2N",
      "name": "Sân vận động Mỹ Đình",
      "address": "Lê Đức Thọ, Nam Từ Liêm",
      "city": "Hà Nội",
      "capacity": 40000,
      "map_url": "https://maps.example/my-dinh"
    }
  ],
  "pagination": {
    "next_cursor": null,
    "has_more": false,
    "limit": 20
  },
  "meta": {
    "request_id": "req_01JX9Q6N4E"
  }
}
```

---

### 7.2. `POST /admin/venues`

Tạo venue.

**Request**

```json
{
  "name": "Sân vận động Mỹ Đình",
  "address": "Lê Đức Thọ, Nam Từ Liêm",
  "city": "Hà Nội",
  "capacity": 40000,
  "map_url": "https://maps.example/my-dinh"
}
```

**Response `201`**

```json
{
  "data": {
    "id": "ven_01JX9Q2N",
    "name": "Sân vận động Mỹ Đình",
    "created_at": "2026-05-30T10:15:30Z"
  },
  "meta": {
    "request_id": "req_01JX9Q6N4E"
  }
}
```

**Ràng buộc**

- `capacity > 0`.
- `name`, `address`, `city` bắt buộc.
- Tạo/cập nhật venue phải ghi audit log.

---

### 7.3. `PATCH /admin/venues/{venue_id}`

Cập nhật venue.

**Request**

```json
{
  "name": "Sân vận động Mỹ Đình",
  "address": "Lê Đức Thọ, Nam Từ Liêm",
  "city": "Hà Nội",
  "capacity": 40000,
  "map_url": "https://maps.example/my-dinh"
}
```

**Response `200`**

```json
{
  "data": {
    "id": "ven_01JX9Q2N",
    "updated_at": "2026-05-30T10:20:30Z"
  },
  "meta": {
    "request_id": "req_01JX9Q6N4E"
  }
}
```

**Side effects**

- Invalidate các concert metadata đang tham chiếu venue đó.
- Ghi audit log `UPDATE_VENUE`.

---

### 7.4. `GET /admin/concerts`

Danh sách concert cho admin/organizer, bao gồm nhiều trạng thái.

**Query parameters**

| Tên | Kiểu | Bắt buộc | Mô tả |
| --- | --- | --- | --- |
| `status` | string | Không | `DRAFT`, `PUBLISHED`, `CANCELLED`, `COMPLETED`. |
| `q` | string | Không | Tìm theo title/artist. |
| `venue_id` | string | Không | Lọc theo venue. |
| `from` | datetime | Không | Lọc theo `starts_at`. |
| `to` | datetime | Không | Lọc theo `starts_at`. |
| `limit` | number | Không | Mặc định `20`, tối đa `100`. |
| `cursor` | string | Không | Cursor trang tiếp theo. |

Route này chỉ `ADMIN` và thấy mọi concert. BTC xem concert của mình qua `GET /organizer/concerts` (xem `organizer-api.md`).

---

### 7.5. `POST /admin/concerts`

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
    "status": "DRAFT",
    "created_at": "2026-05-30T10:15:30Z"
  },
  "meta": {
    "request_id": "req_01JX9Q6N4E"
  }
}
```

**Ràng buộc**

- `venue_id` phải tồn tại.
- `slug` unique.
- `ends_at > starts_at`.
- `status` ban đầu luôn là `DRAFT`.
- `organizer_id` lấy từ user hiện tại nếu caller là `ORGANIZER`; Admin có thể truyền `organizer_id` ở phase sau nếu cần.
- Ghi audit log `CREATE_CONCERT`.

---

### 7.6. `PATCH /admin/concerts/{concert_id}`

Cập nhật thông tin concert.

**Request**

```json
{
  "title": "Anh Trai Say Hi Live Concert",
  "description": "Concert âm nhạc quy mô lớn.",
  "artist_name": "Various Artists",
  "starts_at": "2026-08-10T12:00:00Z",
  "ends_at": "2026-08-10T16:00:00Z",
  "cover_image_url": "https://cdn.ticketbox.vn/concerts/anh-trai-say-hi.webp"
}
```

**Response `200`**

```json
{
  "data": {
    "id": "crt_01JX9Q2M5P7KZ3R4N8Y6",
    "status": "DRAFT",
    "updated_at": "2026-05-30T10:20:30Z"
  },
  "meta": {
    "request_id": "req_01JX9Q6N4E"
  }
}
```

**Ràng buộc**

- Route này chỉ `ADMIN`. BTC sửa concert `DRAFT` của mình qua `POST /organizer/concerts/{concert_id}` (xem `organizer-api.md`).
- Không cho sửa `id`, `organizer_id`, trạng thái bằng endpoint này.
- Nếu concert đã `PUBLISHED`, update metadata phải invalidate cache ngay.
- Ghi audit log `UPDATE_CONCERT`.

---

### 7.7. `POST /admin/concerts/{concert_id}/publish`

Chuyển concert sang `PUBLISHED`.

**Response `200`**

```json
{
  "data": {
    "id": "crt_01JX9Q2M5P7KZ3R4N8Y6",
    "status": "PUBLISHED",
    "published_at": "2026-05-30T10:25:30Z"
  },
  "meta": {
    "request_id": "req_01JX9Q6N4E"
  }
}
```

**Điều kiện publish**

- Concert có venue hợp lệ.
- `starts_at` và `ends_at` hợp lệ.
- Có ít nhất một `seat_zone`.
- Có ít nhất một `ticket_type`.
- Tổng `ticket_types.total_quantity` theo từng zone không vượt quá `seat_zones.capacity`.
- Các ticket type có `sale_end_at > sale_start_at`.

**Side effects**

- Warm Redis metadata cache.
- Purge/invalidate list cache.
- Ghi audit log `PUBLISH_CONCERT`.

---

### 7.8. `POST /admin/concerts/{concert_id}/cancel`

Hủy concert.

**Request**

```json
{
  "reason": "Sự kiện bị hoãn do lý do vận hành."
}
```

**Response `200`**

```json
{
  "data": {
    "id": "crt_01JX9Q2M5P7KZ3R4N8Y6",
    "status": "CANCELLED",
    "cancelled_at": "2026-05-30T10:30:30Z"
  },
  "meta": {
    "request_id": "req_01JX9Q6N4E"
  }
}
```

**Ràng buộc**

- Không xóa vật lý concert đã có giao dịch.
- Payment/refund là trách nhiệm Payment/Ticketing module, endpoint này chỉ đổi trạng thái catalog và phát event nội bộ nếu cần.
- Invalidate toàn bộ catalog cache liên quan.
- Ghi audit log `CANCEL_CONCERT`.
- **Sprint 6:** `setConcertStatus` (dùng bởi `cancel`) set `status = DISABLED` cho mọi checker account của concert trong cùng transaction. Áp dụng cho cả `CANCELLED` và `COMPLETED` (xem `organizer-admin-api.md` §7).

---

### 7.9. `POST /admin/concerts/{concert_id}/seat-zones`

Tạo khu vực chỗ ngồi/khu đứng cho concert.

**Request**

```json
{
  "code": "SVIP",
  "name": "SVIP",
  "description": "Khu vực gần sân khấu.",
  "capacity": 200,
  "svg_path": "M10 10 H120 V80 H10 Z",
  "sort_order": 1
}
```

**Response `201`**

```json
{
  "data": {
    "id": "zon_01JX9Q4A",
    "concert_id": "crt_01JX9Q2M5P7KZ3R4N8Y6",
    "code": "SVIP",
    "created_at": "2026-05-30T10:15:30Z"
  },
  "meta": {
    "request_id": "req_01JX9Q6N4E"
  }
}
```

**Ràng buộc**

- `code` unique theo `(concert_id, code)`.
- `capacity > 0`.
- Tổng capacity các zone nên không vượt quá `venues.capacity`; nếu vượt, trả `422 ZONE_CAPACITY_EXCEEDED`.
- Invalidate metadata và seat map cache.

---

### 7.10. `PATCH /admin/seat-zones/{seat_zone_id}`

Cập nhật khu vực.

**Request**

```json
{
  "name": "SVIP",
  "description": "Khu vực gần sân khấu.",
  "capacity": 250,
  "svg_path": "M10 10 H140 V80 H10 Z",
  "sort_order": 1
}
```

**Response `200`**

```json
{
  "data": {
    "id": "zon_01JX9Q4A",
    "updated_at": "2026-05-30T10:20:30Z"
  },
  "meta": {
    "request_id": "req_01JX9Q6N4E"
  }
}
```

**Ràng buộc**

- Không giảm `capacity` xuống thấp hơn tổng `ticket_types.total_quantity` đã cấu hình cho zone nếu không có nghiệp vụ điều chỉnh rõ ràng.
- Nếu zone đã có ticket/guest/check-in mapping, không đổi `code` tùy tiện.
- Invalidate `catalog:metadata:{concert_id}` và CDN metadata.

---

### 7.11. `POST /admin/concerts/{concert_id}/ticket-types`

Tạo loại vé và tồn kho ban đầu.

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

- `seat_zone_id` phải thuộc `concert_id`.
- `price.amount >= 0`.
- `currency = VND` trong scope hiện tại.
- `total_quantity <= seat_zone.capacity` sau khi cộng các ticket type trong cùng zone.
- `available_quantity` trả về khi tạo mới là computed field bằng `total_quantity - held_quantity - sold_quantity`; DB chỉ lưu `total_quantity`, `held_quantity`, `sold_quantity`.
- `max_per_user > 0`.
- `sale_end_at > sale_start_at`.
- Ghi `audit_logs` loại `INVENTORY_INITIALIZED` hoặc `TICKET_TYPE_CREATED` nếu cần audit tồn kho ban đầu.
- Invalidate ticket type cache và inventory snapshot.

---

### 7.12. `PATCH /admin/ticket-types/{ticket_type_id}`

Cập nhật loại vé.

**Request**

```json
{
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
```

**Response `200`**

```json
{
  "data": {
    "id": "tkt_01JX9Q5A",
    "status": "ON_SALE",
    "updated_at": "2026-05-30T10:20:30Z"
  },
  "meta": {
    "request_id": "req_01JX9Q6N4E"
  }
}
```

**Ràng buộc**

- Không nhận `available_quantity` trong request; không sửa trực tiếp `held_quantity`, `sold_quantity` bằng endpoint này.
- Tăng/giảm `total_quantity` sau khi đã bán vé phải đi qua nghiệp vụ inventory adjustment riêng của Ticketing/Admin Inventory.
- Không cho `max_per_user` nhỏ hơn số vé user đã mua nếu không có policy xử lý rõ.
- `sale_end_at > sale_start_at`.
- Status hợp lệ: `DRAFT`, `ON_SALE`, `SOLD_OUT`, `CLOSED`.
- Invalidate catalog metadata, ticket types cache và Redis inventory.

---

## 8. Cache, invalidation và graceful degradation

### 8.1. Cache keys

| Dữ liệu | Key gợi ý | TTL |
| --- | --- | --- |
| Concert list | `catalog:list:{hash(query)}` | 5-30 phút |
| Concert detail | `catalog:concert:{concert_id}` | 1-24 giờ |
| Metadata | `catalog:metadata:{concert_id}` | 24 giờ |
| Seat map metadata | `catalog:seat-map:{concert_id}` | 24 giờ |
| Ticket types | `catalog:ticket-types:{concert_id}:{include_closed}` | 5-30 phút |
| Inventory | `inventory:concert:{concert_id}` | 5-10 giây hoặc update theo event |

### 8.2. Invalidation rules

| Hành động admin | Cache cần xóa |
| --- | --- |
| Tạo/cập nhật venue | Concert metadata/list của các concert dùng venue. |
| Tạo/cập nhật concert | `catalog:concert:{id}`, `catalog:metadata:{id}`, `catalog:list:*`. |
| Publish/cancel concert | `catalog:concert:{id}`, `catalog:metadata:{id}`, `catalog:list:*`, CDN metadata URL. |
| Tạo/cập nhật seat zone | `catalog:metadata:{id}`, `catalog:seat-map:{id}`, CDN metadata/seat-map URL. |
| Tạo/cập nhật ticket type | `catalog:metadata:{id}`, `catalog:ticket-types:{id}:*`, `inventory:concert:{id}`. |
| Active artist bio thay đổi | `catalog:concert:{id}`, `catalog:metadata:{id}`, CDN metadata URL. |

### 8.3. Graceful degradation

- Metadata CDN origin lỗi: CDN dùng `stale-if-error` để trả snapshot cũ.
- Redis inventory lỗi có snapshot: trả `200` với `display_status = UPDATING`.
- Redis inventory lỗi không snapshot: trả `503 INVENTORY_UNAVAILABLE`.
- PostgreSQL không được query trên đường nóng inventory khi Redis đang lỗi hàng loạt; tránh làm sập source of truth.

---

## 9. Rate limiting

| Nhóm endpoint | Key | Ngưỡng gợi ý |
| --- | --- | --- |
| `GET /concerts` | IP | `200 requests/phút` |
| `GET /concerts/{id}/metadata` | IP + concert | CDN/WAF xử lý là chính |
| `GET /concerts/{id}/seat-map` | IP + concert | CDN/WAF xử lý là chính |
| `GET /concerts/{id}/inventory` | IP + concert | `120 requests/phút` |
| Admin write | user | `60 requests/phút` |

Response `429`:

```json
{
  "type": "https://api.ticketbox.vn/errors/rate-limited",
  "title": "Tần suất truy cập quá cao",
  "status": 429,
  "code": "RATE_LIMITED",
  "detail": "Vui lòng đợi trước khi thử lại.",
  "instance": "/v1/concerts/crt_01JX9Q2M5P7KZ3R4N8Y6/inventory",
  "request_id": "req_01JX9Q6N4G"
}
```

Header:

```http
Retry-After: 30
```

---

## 10. Error catalog

| HTTP | Code | Khi nào xảy ra |
| --- | --- | --- |
| `400` | `INVALID_QUERY` | Query param sai format hoặc vượt giới hạn. |
| `400` | `INVALID_SORT` | Sort không thuộc danh sách cho phép. |
| `401` | `UNAUTHORIZED` | Admin endpoint thiếu JWT. |
| `403` | `FORBIDDEN` | Role không đủ quyền hoặc organizer không sở hữu concert. |
| `404` | `CONCERT_NOT_FOUND` | Concert không tồn tại hoặc chưa public với guest. |
| `404` | `VENUE_NOT_FOUND` | Venue không tồn tại. |
| `404` | `SEAT_ZONE_NOT_FOUND` | Seat zone không tồn tại. |
| `404` | `TICKET_TYPE_NOT_FOUND` | Ticket type không tồn tại. |
| `409` | `SLUG_ALREADY_EXISTS` | Slug concert bị trùng. |
| `409` | `SEAT_ZONE_CODE_ALREADY_EXISTS` | Code zone trùng trong một concert. |
| `422` | `INVALID_SALE_WINDOW` | `sale_end_at <= sale_start_at`. |
| `422` | `INVALID_CONCERT_TIME_RANGE` | `ends_at <= starts_at`. |
| `422` | `ZONE_CAPACITY_EXCEEDED` | Tổng vé/khu vượt capacity zone hoặc venue. |
| `422` | `CANNOT_PUBLISH_CONCERT` | Thiếu venue/zone/ticket type hoặc dữ liệu chưa hợp lệ. |
| `429` | `RATE_LIMITED` | Vượt rate limit. |
| `503` | `INVENTORY_UNAVAILABLE` | Redis inventory/circuit breaker không thể phục vụ. |

---

## 11. Quy tắc triển khai backend

1. Public endpoint không trả concert `DRAFT`.
2. Không dùng Redis inventory để quyết định bán vé. Ticketing Module phải lock PostgreSQL.
3. Admin update phải ghi audit log với `before_data`, `after_data`.
4. Admin update dữ liệu public phải invalidate Redis và CDN.
5. Metadata endpoint nên dùng SingleFlight khi cache miss.
6. Inventory endpoint phải ưu tiên Redis và snapshot fallback; không biến PostgreSQL thành fallback nóng.
7. Các response public phải có `ETag` nếu cache được.
8. Không trả stack trace hoặc thông tin hạ tầng nội bộ trong lỗi.

---

## 12. Acceptance criteria

- `GET /concerts` chỉ trả concert `PUBLISHED`, có filter/pagination ổn định.
- `GET /concerts/{id}/metadata` trả đủ concert, venue, seat zones, ticket types, active artist bio và asset URLs.
- Metadata public có header cache dài, hỗ trợ `ETag`, `stale-while-revalidate`, `stale-if-error`.
- `GET /concerts/{id}/inventory` trả số vé còn lại từ Redis với `consistency = EVENTUAL`.
- Redis lỗi có fallback snapshot thì UI vẫn hiển thị được trạng thái "Đang cập nhật".
- Admin tạo/cập nhật concert, zone, ticket type tuân thủ ràng buộc trong `database-design.md`.
- Publish concert bị chặn nếu thiếu venue, zone, ticket type hoặc dữ liệu sale window/capacity không hợp lệ.
- Mọi admin write tạo audit log và invalidate cache liên quan.
- `POST /admin/concerts`, `GET/POST /admin/venues`, `*/seat-zones`, `*/ticket-types` → 404 (đã chuyển sang luồng duyệt hồ sơ / `/organizer/*`).
- ORGANIZER gọi route `/admin/concerts/*` → 403.
- `POST /admin/concerts/{id}/cancel` → checker account của concert chuyển `DISABLED`.
