# VIEW CONCERT

---

##  Chi tiết Giao diện Lập trình Ứng dụng (API Specifications)

### 1. Lấy danh sách Concert công khai (Catalog)

* **Endpoint:** `GET /v1/concerts`
* **Tên miền áp dụng:** `https://api.ticketbox.vn/v1`
* **Cơ chế Cache:** Lớp CDN lưu bộ nhớ đệm với cấu hình `Cache-Control: public, s-maxage=3600, stale-while-revalidate=600`.

#### Hoạt động của Hệ thống (Hạ tầng):

API Gateway nhận yêu cầu, kiểm tra bộ nhớ đệm CDN. Nếu gặp hiện tượng `Cache Miss`, hệ thống sẽ truy vấn cơ sở dữ liệu với điều kiện trạng thái `status = 'PUBLISHED'` và sắp xếp theo thời gian bắt đầu `starts_at ASC`.

#### Response `200 OK`:

```json
{
  "data": [
    {
      "id": "crt_01JX9Q2M5P7KZ3R4N8Y6",
      "title": "Anh Trai Say Hi — Live Concert 2026",
      "slug": "anh-trai-say-hi-live-concert-2026",
      "cover_image_url": "https://cdn.ticketbox.vn/images/concerts/atsi2026_cover.jpg",
      "starts_at": "2026-09-15T12:00:00Z",
      "ends_at": "2026-09-15T16:00:00Z",
      "venue": {
        "name": "Sân vận động Quân khu 7",
        "city": "Ho Chi Minh"
      },
      "ticket_price_range": {
        "min_amount": 500000,
        "max_amount": 4500000,
        "currency": "VND"
      }
    }
  ],
  "pagination": {
    "next_cursor": "eyJpZCI6ImNydF8wMSJ9",
    "has_more": true,
    "limit": 20
  },
  "meta": {
    "request_id": "req_01JX9Q6N4E"
  }
}

```

---

### 2. Lấy Thông tin Metadata Tĩnh của Concert (CDN Hard Caching)

* **Endpoint:** `GET /v1/concerts/{id}/metadata`
* **Tên miền áp dụng:** `https://cdn.ticketbox.vn/api/v1` (Định tuyến trực tiếp đến tầng lưu trữ phân tán cạnh).
* **Cơ chế Cache:** Đóng băng bộ nhớ đệm cực dài: `Cache-Control: public, s-maxage=86400, stale-while-revalidate=3600`. Hệ thống thực hiện chiến lược xóa bộ nhớ đệm chủ động (**Active Purge Cache**) thông qua lệnh API từ Admin Module đến CDN khi Ban tổ chức thay đổi thông tin.

#### Response `200 OK`:

```json
{
  "data": {
    "id": "crt_01JX9Q2M5P7KZ3R4N8Y6",
    "title": "Anh Trai Say Hi — Live Concert 2026",
    "slug": "anh-trai-say-hi-live-concert-2026",
    "description": "Đêm nhạc trực tiếp quy tụ những màn trình diễn bùng nổ nhất năm 2026.",
    "artist_name": "Lineup Anh Trai Say Hi",
    "starts_at": "2026-09-15T12:00:00Z",
    "ends_at": "2026-09-15T16:00:00Z",
    "artist_bio": {
      "language": "vi",
      "bio_text": "Tuyển tập tóm tắt tiểu sử nghệ sĩ phục vụ đêm diễn, tổng hợp tự động bằng công nghệ trí tuệ nhân tạo từ hồ sơ báo chí chính thức của ban tổ chức."
    },
    "venue": {
      "id": "ven_01JX9Q2M5P7KZ3R4N8Y0",
      "name": "Sân vận động Quân khu 7",
      "address": "202 Hoàng Văn Thụ, Phường 9, Quận Phú Nhuận",
      "city": "Ho Chi Minh",
      "map_url": "https://maps.google.com/?q=Quan+Khu+7+Stadium"
    },
    "seat_zones": [
      {
        "id": "zon_01JX9Q2M5P7KZ3R4N8Z1",
        "code": "SVIP",
        "name": "Khu vực Siêu VIP siêu gần sân khấu",
        "description": "Bao gồm đặc quyền quà tặng và lối đi riêng.",
        "sort_order": 1,
        "svg_layout_path": "https://cdn.ticketbox.vn/layouts/concerts/atsi2026_svip.svg",
        "fallback_image_url": "https://cdn.ticketbox.vn/layouts/concerts/atsi2026_svip_static.jpg"
      },
      {
        "id": "zon_01JX9Q2M5P7KZ3R4N8Z2",
        "code": "GA",
        "name": "Khu vực Phổ thông (Đứng)",
        "description": "Tự do di chuyển trong khu vực chỉ định.",
        "sort_order": 2,
        "svg_layout_path": "https://cdn.ticketbox.vn/layouts/concerts/atsi2026_ga.svg",
        "fallback_image_url": "https://cdn.ticketbox.vn/layouts/concerts/atsi2026_ga_static.jpg"
      }
    ],
    "ticket_types": [
      {
        "id": "tty_01JX9Q2M5P7KZ3R4N9A1",
        "seat_zone_id": "zon_01JX9Q2M5P7KZ3R4N8Z1",
        "name": "SVIP Early Bird",
        "description": "Vé mở bán sớm giới hạn đặc quyền.",
        "price": {
          "amount": 4500000,
          "currency": "VND"
        },
        "max_per_user": 2,
        "sale_start_at": "2026-06-01T00:00:00Z",
        "sale_end_at": "2026-06-10T00:00:00Z"
      },
      {
        "id": "tty_01JX9Q2M5P7KZ3R4N9A2",
        "seat_zone_id": "zon_01JX9Q2M5P7KZ3R4N8Z2",
        "name": "GA Standard",
        "description": "Vé phổ thông tiêu chuẩn.",
        "price": {
          "amount": 500000,
          "currency": "VND"
        },
        "max_per_user": 4,
        "sale_start_at": "2026-06-01T00:00:00Z",
        "sale_end_at": "2026-09-14T00:00:00Z"
      }
    ]
  },
  "meta": {
    "request_id": "req_01JX9Q6N4E"
  }
}

```

---

###  Lấy Trạng thái Kho Vé Thực tế (Real-time Dynamic Inventory)

* **Endpoint:** `GET /v1/concerts/{id}/inventory`
* **Tên miền áp dụng:** `https://api.ticketbox.vn/v1`
* **Cơ chế Cache:** Đọc dữ liệu từ cụm **Redis Cluster**.

#### Bản chất Vận hành Tầng hạ tầng:

Hệ thống sử dụng cấu trúc dữ liệu **Redis Hashes** hoặc các bộ đếm độc lập để quản lý trạng thái tồn kho của từng loại vé (`ticket_type_id`). Chuỗi logic xử lý diễn ra như sau:

1. Hệ thống đọc dữ liệu từ Key: `inventory:concert:{concert_id}`.
2. Trạng thái kinh doanh (`status`) của loại vé được tính toán động dựa trên quy tắc nghiệp vụ:
* Nếu `available_quantity <= 0`, tự động đánh dấu trạng thái là `SOLD_OUT`.
* Nếu thời gian hiện tại nằm ngoài khoảng `sale_start_at` và `sale_end_at` lấy từ metadata, trạng thái trả về là `CLOSED`.



#### Response `200 OK`:

```json
{
  "data": {
    "concert_id": "crt_01JX9Q2M5P7KZ3R4N8Y6",
    "inventories": [
      {
        "ticket_type_id": "tty_01JX9Q2M5P7KZ3R4N9A1",
        "available_quantity": 0,
        "status": "SOLD_OUT"
      },
      {
        "ticket_type_id": "tty_01JX9Q2M5P7KZ3R4N9A2",
        "available_quantity": 1425,
        "status": "ON_SALE"
      }
    ]
  },
  "meta": {
    "request_id": "req_01JX9Q6N4F"
  }
}

```

---

## 4. Xử lý Lỗi chuẩn hóa (RFC 7807) & Kịch bản Hạ cấp Tính năng

Mọi lỗi phát sinh từ hệ thống đều sử dụng định dạng Header `Content-Type: application/problem+json`.

### 4.1. Lỗi Quá tải Tần suất Truy cập (Rate Limited tại Biên mạng)

Do Scalper Bot hoặc người dùng F5 quá nhiều lần liên tục.

#### Response `429 Too Many Requests`:

```json
{
  "type": "https://api.ticketbox.vn/errors/rate-limited",
  "title": "Tần suất truy cập quá cao",
  "status": 429,
  "code": "RATE_LIMITED",
  "detail": "Hệ thống ghi nhận hành vi tải lại trang quá nhanh từ thiết bị của bạn. Vui lòng đợi 30 giây trước khi thử lại.",
  "instance": "/v1/concerts/crt_01JX9Q2M5P7KZ3R4N8Y6/inventory",
  "request_id": "req_01JX9Q6N4G"
}

```

### 4.2. Kịch bản Hạ cấp Tính năng (Graceful Degradation) khi Hệ thống Gốc Quá tải

#### Khách hàng (Client Side) nhận biết qua Mã lỗi Nghiệp vụ (`code`):

Hệ thống phản hồi mã trạng thái lỗi nhưng đính kèm dữ liệu tĩnh cũ hoặc chỉ thị giao diện hiển thị nhãn `"Đang cập nhật"`.

#### Response `503 Service Unavailable` (Chế độ hạ cấp):

```json
{
  "type": "https://api.ticketbox.vn/errors/system-high-load",
  "title": "Hệ thống đang bận xử lý",
  "status": 503,
  "code": "INVENTORY_DEGRADED",
  "detail": "Số lượng vé thực tế đang được xử lý với cường độ cao. Hệ thống tạm thời chuyển sang chế độ xếp hàng tự động. Bạn vẫn có thể xem sơ đồ và chọn vị trí.",
  "instance": "/v1/concerts/crt_01JX9Q2M5P7KZ3R4N8Y6/inventory",
  "request_id": "req_01JX9Q6N4H"
}

```

---

## 5. Ma trận Phân quyền Truy cập (RBAC Matrix)

Nghiệp vụ xem thông tin sự kiện là dịch vụ mở công khai phục vụ cộng đồng để tối ưu hóa hiệu suất SEO và tối đa hóa tỷ lệ chuyển đổi đơn hàng.

| Tên Endpoint | Mã Vai trò (`role_code`) | Phạm vi Quyền hạn sở hữu | Ghi chú |
| --- | --- | --- | --- |
| `GET /v1/concerts` | `GUEST` / Toàn bộ | Công khai (Public) | Không bắt buộc truyền Token JWT. |
| `GET /v1/concerts/{id}/metadata` | `GUEST` / Toàn bộ | Công khai (Public) | Được tối ưu hóa Cache toàn cầu qua các Edge Node. |
| `GET /v1/concerts/{id}/inventory` | `GUEST` / Toàn bộ | Công khai (Public) | Bypass qua các lớp Cache tĩnh, kiểm soát bằng bộ lọc WAF. |