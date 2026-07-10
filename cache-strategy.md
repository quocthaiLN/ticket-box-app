# Cache Strategy — Catalog Public Read

## Vấn đề ban đầu

| Metric | Không cache |
|--------|-------------|
| `http_req_failed` | 4.65% |
| p95 `/ticket-types` | 3.27s |
| p95 `/inventory` | 3.33s |

10 000 lượt xem × 5 API = 50 000 request đập thẳng vào PostgreSQL. DB bị ép tải đến mức latency cao và một phần request fail ở tầng kết nối.

---

## Kiến trúc cache hiện tại

```
HTTP Request
    │
    ▼
CatalogController          (HTTP layer — không chứa cache logic)
    │
    ▼
CatalogService             ◄─── Cache logic đặt ở đây
    │   cacheSingleFlight()
    │       1. GET Redis  ──► hit → return ngay
    │       2. cache miss → kiểm tra inflightMap (atomic)
    │           a. Đã có Promise đang chạy → await → cache hit → return
    │           b. Chưa có → tạo Promise mới, đăng ký map → fetch DB → SET Redis
    │
    ▼
CatalogRepository          (thuần Prisma/PostgreSQL — không biết về cache)
```

### Tại sao đặt cache ở Service, không phải Controller hay Repository?
- **Controller** chỉ lo HTTP request/response.
- **Repository** phải thuần DB — dễ test, dễ thay đổi ORM.
- **Service** là nơi orchestration, phù hợp quyết định "lấy từ đâu".

---

## Cache keys & TTL

| Endpoint | Redis key | TTL | Lý do |
|----------|-----------|-----|-------|
| `GET /concerts` | `catalog:list:<queryHash>` | 300s | Dữ liệu list thay đổi khi thêm/sửa concert |
| `GET /concerts/:id` | `catalog:concert:<id>` | 3600s | Thông tin cơ bản concert ổn định |
| `GET /concerts/:id/metadata` | `catalog:metadata:<id>` | 3600s | Chứa seat_zones + ticket_types, giảm từ 86400s để an toàn |
| `GET /concerts/:id/seat-map` | `catalog:seat-map:<id>` | 86400s | Rất ít thay đổi |
| `GET /concerts/:id/ticket-types` | `catalog:ticket-types:<id>:<variant>` | 300s | Thay đổi khi mở/đóng bán |
| `GET /concerts/:id/inventory` | `inventory:concert:<id>` | 5s | Biến động liên tục theo order |

**queryHash** cho `/concerts`: serialize `q, city, from, to, limit, cursor, sort` theo thứ tự cố định → SHA-256 (16 ký tự). Đảm bảo cùng params, khác thứ tự → cùng 1 key.

---

## Chống Cache Stampede — In-process Single-Flight

### Vấn đề stampede
Khi cache cold hoặc TTL vừa hết, N request đồng thời đều thấy miss → đều đổ vào DB cùng lúc. Với 500 VU và inventory TTL=5s, cứ 5 giây lại có 499 request hit DB đồng thời.

### Giải pháp đã chọn: In-process Promise deduplication

```typescript
// Trong cacheSingleFlight() — packages/redis/src/cache.ts
const inflightRequests = new Map<string, Promise<unknown>>();

// Khi cache miss:
const existing = inflightRequests.get(key);  // atomic — không await ở giữa
if (existing) {
  await existing;          // chờ request đang chạy
  return cacheGet(key);   // lấy từ cache, KHÔNG gọi DB thêm
}
// Tạo Promise mới, đăng ký map, fetch DB, set cache
```

**Tại sao an toàn với Node.js?**  
Node.js single-threaded: giữa `map.get()` và `map.set()` không có `await` → không có coroutine nào chạy xen vào → atomic tuyệt đối, không cần lock.

### So sánh các phương án

| Phương án | Pros | Cons | Kết quả |
|-----------|------|------|---------|
| Không cache | Đơn giản | DB quá tải | `failed=4.65%` |
| `cacheAside` | Đơn giản | Stampede khi cold start | `failed=1.86%` |
| Redis SET NX + polling | Distributed | Thêm 50ms/poll, ~10k Redis GET/s | `failed=3.55%` ❌ |
| **In-process Promise dedup** | Zero overhead, atomic | Chỉ dedup trong 1 process | `failed~0%` ✅ |

> **Tại sao Redis lock tệ hơn cacheAside?**  
> 499 VU poll mỗi 50ms tạo ~10 000 Redis GET/s overhead. Inventory TTL=5s khiến cứ 5s lại có 499 VU bị block thêm 50–500ms, đẩy iteration duration lên cao, gây timeout và tăng `http_req_failed`.

---

## Cache Invalidation

Nguyên tắc: **invalidate ngay sau khi write thành công**, tại Controller layer.

```
Admin action                    Invalidates
────────────────────────────────────────────────────────
createConcert                → catalog:list:*
updateConcert / publishConcert
  / cancelConcert             → concert + metadata + seat-map
                                + ticket-types + inventory + list:*
createSeatZone / updateSeatZone → seat-map + metadata
                                  (metadata chứa seat_zones)
createTicketType / updateTicketType → ticket-types + inventory
                                      + metadata + list:*
                                      (metadata chứa ticket_types,
                                       list có price range từ ticket types)
```

`invalidateConcertCache()` xóa tất cả key của concert — dùng khi publish/cancel/update toàn bộ.

---

## Phân tách dữ liệu

```
Nhóm A — ổn định (cache mạnh, TTL 300s–86400s):
  /concerts, /metadata, /seat-map, /ticket-types

Nhóm B — biến động (cache ngắn, TTL 5s):
  /inventory → chỉ dùng để hiển thị gần đúng trên UI
              → checkout/order vẫn kiểm tra bằng PostgreSQL transaction
```

---

## Kết quả sau khi áp cache

| Metric | Trước | Sau |
|--------|-------|-----|
| `http_req_failed` | 4.65% | ~0% |
| p95 `/metadata` | 2.90s | ~365ms |
| p95 `/seat-map` | 2.37s | ~366ms |
| p95 `/ticket-types` | 3.27s | ~341ms |
| p95 `/inventory` | 3.33s | ~493ms |
| PostgreSQL query volume | 50 000 req | ~số concert × 5 lần (warm) |

Khi test lần cuối với mã nguồn hiện tại thì có kết quả    
checks_total.......: 150000 5930.579338/s
checks_succeeded...: 99.40% 149107 out of 150000
checks_failed......: 0.59%  893 out of 150000
Đa số các lỗi bên dưới đều xuất hiện ở khoảng đầu của test
WARN[0001] Request Failed                                error="Get \"http://host.docker.internal:3000/v1/concerts/00000000-0000-0000-0000-000000000202/inventory\": dial tcp 192.168.65.254:3000: connect: connection refused"