# Báo cáo áp dụng Redis cache cho Catalog

## Bối cảnh

K6 catalog load test hiện mô phỏng một lượt khán giả mở trang concert bằng 5 API public:

```text
GET /v1/concerts/:concert_id
GET /v1/concerts/:concert_id/metadata
GET /v1/concerts/:concert_id/seat-map
GET /v1/concerts/:concert_id/ticket-types
GET /v1/concerts/:concert_id/inventory
```

Kết quả gần nhất với `CATALOG_TOTAL_REQUESTS=10000`, `CATALOG_VUS=500`:

```text
50,000 HTTP requests
http_req_failed = 4.65%
p95 detail       = 2.78s
p95 metadata     = 2.90s
p95 seat-map     = 2.37s
p95 ticket-types = 3.27s
p95 inventory    = 3.33s
404 = 0, 429 = 0, 5xx = 0
```

Điều này cho thấy request không bị rate limit, không sai concert, không trả lỗi ứng dụng, nhưng API/DB đang bị ép tải đến mức latency cao và một phần request fail ở tầng kết nối/client.

## Hiện trạng code

Public routes trong `ticket-box-app/apps/api-server/src/modules/catalog/catalog.router.ts`:

```text
/concerts
/concerts/:concert_id
/concerts/:concert_id/metadata
/concerts/:concert_id/seat-map
/concerts/:concert_id/ticket-types
/concerts/:concert_id/inventory
```

Controller gọi service, service gọi thẳng repository:

```text
CatalogController -> CatalogService -> CatalogRepository -> Prisma/PostgreSQL
```

Các hàm public read trong `catalog.repository.ts` đều đọc trực tiếp DB:

```text
listPublishedConcerts()
getPublishedConcertById()
getConcertMetadata()
getSeatMap()
listTicketTypes()
getInventorySnapshot()
```

Trong `packages/redis/src/cache.ts` đã có cache helper:

```text
cacheGet
cacheSet
cacheAside
cacheDelete
cacheDeletePattern
```

Trong `packages/redis/src/catalog-cache.ts` đã có key và TTL catalog:

```text
catalog:list:*                         TTL 300s
catalog:concert:<concertId>            TTL 3600s
catalog:metadata:<concertId>           TTL 86400s
catalog:seat-map:<concertId>           TTL 86400s
catalog:ticket-types:<concertId>:*     TTL 300s
inventory:concert:<concertId>          TTL 5s
```

Controller cũng đã gọi một số hàm invalidate:

```text
invalidateConcertListCache()
invalidateConcertCache(concertId)
invalidateSeatMapCache(concertId)
invalidateTicketTypeCache(concertId)
```

Nhưng hiện tại public read chưa gọi `cacheAside`, nên Redis cache hạ tầng đã có nhưng chưa được áp vào đường đọc catalog.

## Vấn đề chính

1. Catalog public read đang đập trực tiếp vào PostgreSQL qua Prisma ở mỗi request.
2. Một lượt xem concert đang gọi 5 API, nên 10,000 lượt xem tạo khoảng 50,000 DB-backed requests.
3. Endpoint chậm nhất là `inventory` và `ticket-types`, đúng với việc hai endpoint này đọc ticket types và seat zone.
4. Không có `429` và `5xx`, nên bottleneck hiện tại không phải rate limit hay business error, mà là throughput/latency của API + Prisma + PostgreSQL.
5. Redis cache đã có key/TTL/invalidation nhưng chưa nối vào service/repository read path.

## Gợi ý từ thầy và cách hiểu trong hệ thống hiện tại

Gợi ý:

```text
Trang chủ và trang chi tiết concert bị quá tải: Trang danh sách concert và trang chi tiết từng concert bị đọc với tần suất rất cao (hàng nghìn lần/giây trong giờ cao điểm) nhưng dữ liệu thay đổi không thường xuyên. Nếu mỗi request đều truy vấn thẳng vào database, hệ thống sẽ không chịu được tải. Cần có chiến lược cache hợp lý để giảm tải cho database mà vẫn đảm bảo dữ liệu đủ cập nhật (ví dụ: số vé còn lại phải phản ánh gần đúng thực tế).
```

Áp vào TicketBox:

1. Trang chủ/list concert tương ứng `GET /v1/concerts`.
2. Trang chi tiết concert tương ứng nhóm API `GET /v1/concerts/:concert_id`, `/metadata`, `/seat-map`, `/ticket-types`, `/inventory`.
3. Dữ liệu mô tả concert, venue, seat map, ticket type gần như là dữ liệu đọc nhiều, đổi ít.
4. Dữ liệu số vé còn lại biến động theo order/payment, nhưng ở UI public chỉ cần gần đúng trong vài giây. Quyết định giữ vé/mua vé vẫn phải dùng DB transaction ở order flow.

Vì vậy không nên xem tất cả catalog data như một loại cache duy nhất. Cần tách thành 2 nhóm:

```text
Nhóm A - dữ liệu ổn định:
/concerts
/concerts/:concert_id
/metadata
/seat-map
/ticket-types

Nhóm B - dữ liệu biến động:
/inventory
```

Nhóm A nên cache mạnh để giảm tải DB. Nhóm B nên cache ngắn để giảm tần suất đọc DB nhưng vẫn đủ cập nhật cho màn hình chọn vé.

## Rủi ro nếu cache sai

Không nên chỉ bọc cache ngay bằng TTL hiện tại mà chưa chỉnh invalidation, vì `metadata` chứa cả `seat_zones` và `ticket_types`.

Hiện tại:

```text
createSeatZone/updateSeatZone -> invalidateSeatMapCache()
createTicketType/updateTicketType -> invalidateTicketTypeCache()
```

Nhưng:

```text
/metadata cũng chứa seat_zones và ticket_types
```

Vì vậy nếu cache `catalog:metadata:<concertId>` với TTL 86400s mà không xoá metadata khi đổi seat zone/ticket type, audience có thể thấy dữ liệu cũ rất lâu.

Ngoài ra `getPublishedConcert(concertId)` nhận cả UUID hoặc slug. Nếu cache key dùng raw input slug, nhưng invalidate chỉ theo UUID, cache slug có thể không bị xoá. Cần thống nhất key theo concert UUID hoặc chấp nhận TTL ngắn cho key theo slug.

## Đề xuất sửa

### 1. Áp cache-aside ở service layer

Nên đặt cache ở `CatalogService`, không đặt trực tiếp trong controller. Lý do:

- Controller chỉ lo HTTP response.
- Repository vẫn thuần DB/Prisma.
- Service đang là nơi xử lý not-found và orchestration.

Import từ `@ticketbox/redis`:

```ts
import {
  cacheAside,
  catalogCacheKeys,
  catalogCacheTtlSeconds,
} from "@ticketbox/redis";
```

Áp dụng cho:

```text
listPublishedConcerts(query)
getPublishedConcert(concertId)
getMetadata(concertId)
getSeatMap(concertId)
listTicketTypes(concertId, includeClosed)
getInventory(concertId)
```

### 2. Ưu tiên cache các endpoint ổn định trước

Thứ tự nên làm:

1. `seat-map`: rất ít đổi, TTL dài an toàn nếu invalidate đúng.
2. `ticket-types`: ít đổi hơn inventory, TTL 300s hợp lý.
3. `metadata`: cache được, nhưng phải mở rộng invalidation trước.
4. `concert detail`: cache được, chú ý slug vs UUID.
5. `inventory`: cache ngắn 5s, chỉ dùng eventual consistency.
6. `listPublishedConcerts`: cache query hash, TTL 300s.

Mapping theo trang:

```text
Trang chủ:
GET /v1/concerts
  -> cache list theo query
  -> TTL 60-300s
  -> invalidate khi publish/cancel/update concert hoặc đổi ticket type ảnh hưởng price range

Trang chi tiết:
GET /v1/concerts/:concert_id
GET /v1/concerts/:concert_id/metadata
GET /v1/concerts/:concert_id/seat-map
GET /v1/concerts/:concert_id/ticket-types
  -> cache theo concert
  -> TTL từ 300s đến 86400s tuỳ loại dữ liệu
  -> invalidate khi admin sửa concert/seat zone/ticket type

Số vé còn lại:
GET /v1/concerts/:concert_id/inventory
  -> cache TTL 3-5s
  -> chỉ dùng để hiển thị gần đúng
  -> checkout/order vẫn kiểm tra lại bằng PostgreSQL transaction
```

### 3. Mở rộng invalidation trước khi cache metadata

Nên sửa các invalidation như sau:

```text
invalidateSeatMapCache(concertId)
  -> xoá seat-map
  -> xoá metadata

invalidateTicketTypeCache(concertId)
  -> xoá ticket-types false/true
  -> xoá inventory
  -> xoá metadata
  -> xoá catalog:list:*
```

Lý do:

- Metadata hiển thị seat zones và ticket types.
- List concert có price range lấy từ ticket types.
- Inventory phụ thuộc `total_quantity`, `held_quantity`, `sold_quantity`, status ticket type.

### 4. Cẩn thận với inventory

`/inventory` là dữ liệu biến động khi có order giữ vé/thanh toán:

```text
available = total_quantity - held_quantity - sold_quantity
```

TTL 5s là hợp lý cho public display, nhưng không được dùng inventory cache để quyết định đặt vé. Checkout vẫn phải dùng PostgreSQL transaction/row lock ở order flow.

Nếu muốn UI chính xác hơn theo user, tiếp tục dùng endpoint quota/authenticated riêng, không trộn user-specific data vào public inventory cache.

### 5. Chống cache stampede

Với 500 VUs, nếu cache miss đồng thời thì nhiều request có thể cùng đập DB trước khi cache được set. `cacheAside` hiện tại đơn giản:

```text
GET cache -> miss -> fetch DB -> SET cache
```

Nên cân nhắc thêm lock nhẹ bằng Redis `SET NX` cho các key nóng, hoặc chấp nhận vì sau warmup cache sẽ hit. Tối thiểu, k6 setup đã warmup 5 endpoint nên cache nên được nạp trước khi vào load chính.

## Plan triển khai đề xuất

### Bước 1: Sửa invalidation

File:

```text
ticket-box-app/packages/redis/src/catalog-cache.ts
```

Việc cần làm:

- `invalidateSeatMapCache()` xoá thêm metadata.
- `invalidateTicketTypeCache()` xoá thêm metadata và list.
- Nếu có update venue/concert ảnh hưởng detail/list/metadata thì giữ `invalidateConcertCache()` như hiện tại.

### Bước 2: Thêm cache vào service

File:

```text
ticket-box-app/apps/api-server/src/modules/catalog/catalog.service.ts
```

Gợi ý mapping:

```text
listPublishedConcerts(query)
  -> catalogCacheKeys.list(hashQuery(query)), TTL 300

getPublishedConcert(concertId)
  -> catalogCacheKeys.concert(concertId), TTL 3600

getMetadata(concertId)
  -> catalogCacheKeys.metadata(concertId), TTL nên cân nhắc 300 hoặc 3600 thay vì 86400 nếu invalidation chưa phủ đủ

getSeatMap(concertId)
  -> catalogCacheKeys.seatMap(concertId), TTL 86400

listTicketTypes(concertId, includeClosed)
  -> catalogCacheKeys.ticketTypes(concertId, includeClosed), TTL 300

getInventory(concertId)
  -> catalogCacheKeys.inventory(concertId), TTL 5
```

### Bước 3: Chuẩn hoá cache key cho list query

Với `/concerts`, cần hash query ổn định. Ví dụ:

```text
q, city, from, to, limit, cursor, sort
```

Nên serialize theo thứ tự cố định trước khi hash, tránh hai object cùng nghĩa nhưng khác thứ tự tạo hai cache key khác nhau.

### Bước 4: Quyết định key cho concert id/slug

Nếu chỉ dùng `catalogCacheKeys.concert(concertId)` với raw param:

- UUID request sẽ cache theo UUID.
- Slug request sẽ cache theo slug.
- Invalidation theo UUID không xoá slug key.

Cách an toàn hơn:

1. Public frontend/load test dùng UUID cho route này.
2. Hoặc thêm bước resolve identity sang UUID trước khi cache.
3. Hoặc TTL cho `concert` giữ ngắn hơn nếu vẫn cache raw param.

### Bước 5: Verify

Chạy lại sau khi bật Redis và warmup:

```bash
docker exec -i ticketbox-redis redis-cli flushall
docker compose run --rm k6 run /tests/catalog/catalog.ts
```

Theo dõi:

```text
http_req_failed
p95 từng endpoint
Redis INFO stats/keyspace
PostgreSQL connection count
API logs
```

Kỳ vọng sau cache:

```text
http_req_failed giảm về 0
p95 detail/metadata/seat-map/ticket-types giảm mạnh
inventory cải thiện nhưng vẫn có thể cao hơn vì TTL ngắn 5s
PostgreSQL query volume giảm rõ rệt
```

## Kết luận

Vấn đề hiện tại không nằm ở k6 script hay route catalog sai. K6 đã chứng minh toàn bộ API trả dữ liệu đúng trong phần lớn request, nhưng khi tăng lên 10,000 lượt xem với 500 VUs, public read path bị chậm vì mỗi API vẫn đi thẳng vào Prisma/PostgreSQL.

Repo đã có sẵn phần lớn hạ tầng Redis cache: key, TTL, cache-aside helper, và invalidation helper. Việc cần làm là nối cache vào `CatalogService`, đồng thời sửa invalidation cho `metadata` trước để tránh stale data. Cách làm này đúng với mục tiêu: giảm tải DB cho public catalog hot read, nhưng vẫn giữ PostgreSQL là nguồn dữ liệu quyết định cho checkout/order.
