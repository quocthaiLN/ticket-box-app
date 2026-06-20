# Kế hoạch chi tiết: Refactor role/route + module organizer — TicketBox

## Context

Hệ thống đang để nhiều route `/admin/*` cho cả `ORGANIZER` lẫn `ADMIN`, khiến BTC làm được việc của admin. Mục tiêu: mỗi route chỉ đúng **1 role**, tách `/organizer/*` riêng cho BTC, bổ sung luồng duyệt hồ sơ tổ chức concert. Các quyết định đã chốt:

- **Sửa concert (BTC):** BTC sửa **trực tiếp** concert `DRAFT` của mình (không cần duyệt). Admin có route sửa riêng.
- **Ticket type / seat zone:** BTC khai trong hồ sơ; **admin approve thì hệ thống tự tạo** seat zones + ticket types + gates + checker accounts.
- **Bổ sung scope:** (1) route BTC xin xóa concert → admin duyệt; (2) checker tự `DISABLED` khi concert kết thúc/hủy; (3) thêm `gate_count` + thông tin số vé vào hồ sơ; (4) `PATCH /v1/auth/me` cho user tự sửa hồ sơ.

---

## Route map cuối cùng (authoritative)

> Mỗi route 1 role. `requireAuth` luôn đứng trước `requireRole`.
> `/auth/logout` và `/auth/me` giữ **chỉ `requireAuth`** (mọi role đã đăng nhập đều cần) — đây là ngoại lệ cross-cutting có chủ đích.

**PUBLIC:** `/auth/otp/request`, `/auth/register`, `/auth/login` (+`redirect_to`), `/auth/refresh`, và toàn bộ `GET /concerts*`.

**AUDIENCE** `requireRole("AUDIENCE")`: `POST /orders`, `GET /orders/:id`, `POST /orders/:id/cancel`, `POST /orders/:id/payments`, `GET /me/tickets*`.

**CHECKER** `requireRole("CHECKER")`: `POST /check-in/scan`, `GET /check-in/preload`, `POST /check-in/offline-sync`, `POST /check-in/offline-batches`, `POST /check-in/offline-batches/:batch_id/items`, `GET /check-in/guests/search`.
→ **Bỏ** các alias/route: `/check-in/scans`, `/check-in/bootstrap`, `/check-in/devices/:id/preload`, `/check-in/gates/:id/preload`, `/guest-list/search`, `/guest-list/scan`, `/check-in/guests/scans`.

**ORGANIZER** `requireRole("ORGANIZER")` — module mới:

```
GET    /v1/organizer/venues                          ← (bổ sung) list venue seed để chọn
GET    /v1/organizer/requests
POST   /v1/organizer/requests                         ← + gate_count, checker_count, ticket_types[]
GET    /v1/organizer/requests/:request_id
GET    /v1/organizer/concerts
POST   /v1/organizer/concerts/:concert_id             ← sửa trực tiếp DRAFT của mình
POST   /v1/organizer/concerts/:concert_id/deletion-requests   ← xin xóa concert
GET    /v1/organizer/concerts/:concert_id/analytics
GET    /v1/organizer/orders                           ← orders của các concert mình sở hữu
GET    /v1/organizer/ticket-types/:ticket_type_id/inventory
GET    /v1/organizer/checker-accounts
GET    /v1/organizer/concerts/:concert_id/guests
```

**ADMIN** `requireRole("ADMIN")`:

```
GET    /v1/admin/concerts
PATCH  /v1/admin/concerts/:concert_id
POST   /v1/admin/concerts/:concert_id/publish
POST   /v1/admin/concerts/:concert_id/cancel
GET    /v1/admin/check-in/gates                       ← chỉ giữ list gate

GET    /v1/admin/notifications*                       ← đổi guard về ADMIN ("suy nghĩ sau")

// Xem lại luồng import với cron job
POST   /v1/guest-list/import                          ← ADMIN
POST   /v1/admin/concerts/:concert_id/guest-import-jobs

GET    /v1/auth/admin/users
PATCH  /v1/auth/admin/users/:user_id/role
PATCH  /v1/auth/admin/users/:user_id/status
PATCH  /v1/auth/admin/users/role-by-email             ← MỚI

GET    /v1/admin/organizer-requests
GET    /v1/admin/organizer-requests/:request_id
POST   /v1/admin/organizer-requests/:request_id/approve   ← tạo concert DRAFT + zones + ticket types + gates + checkers
POST   /v1/admin/organizer-requests/:request_id/reject

GET    /v1/admin/concert-deletion-requests
POST   /v1/admin/concert-deletion-requests/:request_id/approve   ← set concert CANCELLED
POST   /v1/admin/concert-deletion-requests/:request_id/reject

GET    /v1/admin/concerts/:concert_id/checker-accounts
```

→ **Bỏ** routes: `/admin/venues*`, `POST /admin/concerts`, `/admin/concerts/:id/seat-zones`, `/admin/seat-zones/:id`, `/admin/concerts/:id/ticket-types`, `PATCH /admin/ticket-types/:id`, toàn bộ gate/device/mapping write (`POST/GET/:id/PATCH/DELETE/PUT` trừ `GET /admin/check-in/gates`), `GET /admin/ticket-types/:id/inventory` (chuyển sang organizer), `POST /admin/ticket-types/:id/inventory-adjustments`.

**AUTH (cross-cutting)** `requireAuth`: `POST /auth/logout`, `GET /auth/me`, `PATCH /auth/me` (MỚI).

---

## Bước 0 — Chuẩn bị

Xác nhận chạy được: `pnpm --filter @ticketbox/database exec prisma validate`, server build bằng `pnpm --filter api-server build`.

---

## Bước 1 — Database schema + migration

**File:** `packages/database/prisma/schema.prisma`

1. Thêm enum dùng chung cho các luồng duyệt:

```prisma
enum ApprovalStatus {
  PENDING
  APPROVED
  REJECTED
  @@map("approval_status")
}
```

2. Thêm field vào `Concert`:

```prisma
  plannedPublishAt DateTime? @map("planned_publish_at")
```

3. Model `OrganizerRequest` (hồ sơ xin tổ chức):

```prisma
model OrganizerRequest {
  id               String         @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  organizerId      String         @map("organizer_id") @db.Uuid
  venueId          String         @map("venue_id") @db.Uuid
  title            String         @db.VarChar(255)
  artistName       String         @map("artist_name") @db.VarChar(255)
  description      String?
  startsAt         DateTime       @map("starts_at")
  endsAt           DateTime       @map("ends_at")
  plannedPublishAt DateTime       @map("planned_publish_at")
  gateCount        Int            @default(1) @map("gate_count")
  checkerCount     Int            @default(1) @map("checker_count")
  pressKitUrl      String?        @map("press_kit_url")
  ticketTypes      Json           @map("ticket_types")   // [{zoneCode,zoneName,zoneCapacity,name,price,totalQuantity,maxPerUser,saleStartAt,saleEndAt}]
  status           ApprovalStatus @default(PENDING)
  reviewedById     String?        @map("reviewed_by") @db.Uuid
  reviewedAt       DateTime?      @map("reviewed_at")
  reviewNote       String?        @map("review_note")
  concertId        String?        @map("concert_id") @db.Uuid
  createdAt        DateTime       @default(now()) @map("created_at")
  updatedAt        DateTime       @default(now()) @updatedAt @map("updated_at")

  organizer User     @relation("OrganizerRequestOwner", fields: [organizerId], references: [id], onDelete: Restrict)
  reviewer  User?    @relation("OrganizerRequestReviewer", fields: [reviewedById], references: [id], onDelete: SetNull)
  venue     Venue    @relation(fields: [venueId], references: [id], onDelete: Restrict)
  concert   Concert? @relation(fields: [concertId], references: [id], onDelete: SetNull)

  @@index([organizerId, status])
  @@index([status])
  @@map("organizer_requests")
}
```

4. Model `ConcertDeletionRequest` (xin xóa concert):

```prisma
model ConcertDeletionRequest {
  id           String         @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  concertId    String         @map("concert_id") @db.Uuid
  organizerId  String         @map("organizer_id") @db.Uuid
  reason       String?
  status       ApprovalStatus @default(PENDING)
  reviewedById String?        @map("reviewed_by") @db.Uuid
  reviewedAt   DateTime?      @map("reviewed_at")
  reviewNote   String?        @map("review_note")
  createdAt    DateTime       @default(now()) @map("created_at")
  updatedAt    DateTime       @default(now()) @updatedAt @map("updated_at")

  concert   Concert @relation(fields: [concertId], references: [id], onDelete: Cascade)
  organizer User    @relation("DeletionRequestOwner", fields: [organizerId], references: [id], onDelete: Restrict)
  reviewer  User?   @relation("DeletionRequestReviewer", fields: [reviewedById], references: [id], onDelete: SetNull)

  @@index([organizerId, status])
  @@index([concertId])
  @@map("concert_deletion_requests")
}
```

5. Model `ConcertCheckerAccount` (gắn checker ↔ concert, phục vụ list + vô hiệu hóa):

```prisma
model ConcertCheckerAccount {
  id                 String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  concertId          String   @map("concert_id") @db.Uuid
  userId             String   @map("user_id") @db.Uuid
  organizerRequestId String?  @map("organizer_request_id") @db.Uuid
  createdAt          DateTime @default(now()) @map("created_at")

  concert Concert @relation(fields: [concertId], references: [id], onDelete: Cascade)
  user    User    @relation("ConcertCheckerUser", fields: [userId], references: [id], onDelete: Cascade)

  @@unique([concertId, userId])
  @@index([concertId])
  @@index([userId])
  @@map("concert_checker_accounts")
}
```

6. Thêm các quan hệ ngược vào `User`, `Venue`, `Concert`:

- `User`: `organizerRequests OrganizerRequest[] @relation("OrganizerRequestOwner")`, `reviewedOrganizerRequests OrganizerRequest[] @relation("OrganizerRequestReviewer")`, `deletionRequests ConcertDeletionRequest[] @relation("DeletionRequestOwner")`, `reviewedDeletionRequests ConcertDeletionRequest[] @relation("DeletionRequestReviewer")`, `checkerAssignments ConcertCheckerAccount[] @relation("ConcertCheckerUser")`.
- `Venue`: `organizerRequests OrganizerRequest[]`.
- `Concert`: `organizerRequests OrganizerRequest[]`, `deletionRequests ConcertDeletionRequest[]`, `checkerAccounts ConcertCheckerAccount[]`.

7. Tạo migration:

```
pnpm --filter @ticketbox/database exec prisma migrate dev --name sprint6_organizer_request
pnpm --filter @ticketbox/database exec prisma generate
```

---

## Bước 2 — Shared: error helpers

**File:** `apps/api-server/src/shared/http/problem-details.ts`

Thêm các helper `Errors.*` mới (theo pattern hiện có): `organizerRequestNotFound(id)`, `organizerRequestNotPending()`, `concertNotOwnedByOrganizer()`, `concertNotEditable()` (khi không phải DRAFT), `deletionRequestNotFound(id)`, `userNotFoundByEmail(email)`. Mỗi cái trả `status` + `code` phù hợp (404/403/409).

---

## Bước 3 — Auth: redirect_to, role-by-email, PATCH /me

**`auth.controller.ts`**

- Trong `handleLogin`: thêm `redirect_to` vào payload trả về:

```typescript
const redirectMap: Record<string, string> = {
  AUDIENCE: "/",
  ADMIN: "/admin",
  ORGANIZER: "/organizer",
  CHECKER: "/checker",
};
res.status(200).json(
  ok(
    {
      access_token,
      expires_in,
      user,
      redirect_to: redirectMap[user.role] ?? "/",
    },
    req.requestId,
  ),
);
```

- Thêm `handleAdminUpdateRoleByEmail`: parse `updateRoleByEmailSchema` `{email, role}`, gọi `authService.updateUserRoleByEmail(actorId, email, role)`.
- Thêm `handleUpdateMe`: parse `updateMeSchema` `{full_name?, phone?}`, gọi `authService.updateProfile(userId, input)`.

**`auth.schema.ts`** — thêm:

```typescript
export const updateRoleByEmailSchema = z.object({
  email: z.string().email(),
  role: z.enum(["AUDIENCE", "ORGANIZER", "CHECKER", "ADMIN"]),
});
export const updateMeSchema = z.object({
  full_name: z.string().min(1).optional(),
  phone: z.string().min(8).optional(),
});
```

**`auth.service.ts`** — thêm:

- `updateUserRoleByEmail(actorId, email, role)`: `findByEmail` → nếu null `throw Errors.userNotFoundByEmail` → `updateRole` + audit log (tái dùng pattern `updateUserRole`).
- `updateProfile(userId, {full_name, phone})`: gọi repo `updateProfile`.

**`auth.repository.ts`** — thêm `updateProfile(userId, data)` dùng `prisma.user.update`. (`findByEmail` đã có.)

**`auth.router.ts`** — thêm (đặt route `role-by-email` **trước** `/:user_id/role` để tránh nhầm param):

```typescript
authRouter.patch("/me", requireAuth, handleUpdateMe);
authRouter.patch(
  "/admin/users/role-by-email",
  requireAuth,
  requireRole("ADMIN"),
  handleAdminUpdateRoleByEmail,
);
```

---

## Bước 4 — Sửa guard + bỏ route trong các module hiện có

Mỗi file: đổi sang **single role**, xóa các route đánh dấu "bỏ", và **xóa import handler không còn dùng** (tránh lỗi TS noUnusedLocals).

**`catalog.router.ts`**: bỏ biến `organizerOnly`, thêm `adminOnly = [requireAuth, requireRole("ADMIN")]`. Giữ các route public. Trong nhóm admin: **chỉ giữ** `GET /admin/concerts`, `PATCH /admin/concerts/:id`, `POST /admin/concerts/:id/publish`, `POST /admin/concerts/:id/cancel` (đổi sang `...adminOnly`). **Xóa** route: `venues*`, `POST /admin/concerts`, `seat-zones*`, `ticket-types*`. Bỏ import controller method không dùng (`createConcert`, `listVenues`, `createVenue`, `updateVenue`, `createSeatZone`, `updateSeatZone`, `createTicketType`, `updateTicketType`) — nhưng **giữ lại các method trong controller/service/repository** vì organizer-admin approve sẽ tái dùng `service.createConcert/createSeatZone/createTicketType`.

**`checkin.router.ts`**: `checkerOnly = [requireAuth, requireRole("CHECKER")]`, `adminOnly = [requireAuth, requireRole("ADMIN")]`. Giữ checker routes: `scan`, `preload`, `offline-sync`, `offline-batches`, `offline-batches/:id/items` → `...checkerOnly`. **Xóa** alias `scans`, `bootstrap`, `devices/:id/preload`, `gates/:id/preload`. Trong nhóm admin: **chỉ giữ** `GET /admin/check-in/gates` → `...adminOnly`; **xóa** mọi route gate write, device, gate-zone-mapping. Bỏ import handler thừa.

**`order.router.ts`**: `POST /orders`, `GET /orders/:id`, `POST /orders/:id/cancel` → `requireRole('AUDIENCE')`. `GET /admin/orders` → `requireRole('ADMIN')`.

**`payment.router.ts`**: `POST /orders/:id/payments` → `requireRole('AUDIENCE')`.

**`ticket.router.ts`**: 3 route `/me/tickets*` → `requireRole('AUDIENCE')`. `void` giữ `requireRole('ADMIN')`.

**`inventory.router.ts`**: **xóa** `GET /admin/ticket-types/:id/inventory` (chuyển sang organizer) và `POST /admin/ticket-types/:id/inventory-adjustments`. Giữ các route `/internal/*` (không JWT). Bỏ import `getInventoryHandler`, `adjustInventoryHandler` nếu không còn dùng (hoặc giữ `getInventoryHandler` để organizer module tái dùng — xem Bước 5).

**`guest-list.router.ts`**: `adminOnly = [requireAuth, requireRole("ADMIN")]`, `checkerOnly = [requireAuth, requireRole("CHECKER")]`. `POST /guest-list/import`, `POST /admin/concerts/:id/guest-import-jobs`, `GET /admin/concerts/:id/guests` → `...adminOnly`. `GET /check-in/guests/search` → `...checkerOnly`. **Xóa** `GET /guest-list/search`, `POST /guest-list/scan`, `POST /check-in/guests/scans`.

**`notifications.router.ts`**: đổi `adminOnly` value thành `requireRole("ADMIN")` (giữ path).

---

## Bước 5 — Module mới `organizer` (routes ORGANIZER)

**Thư mục:** `apps/api-server/src/modules/organizer/`

**`organizer.schema.ts`** — Zod:

- `createOrganizerRequestSchema`: `{ venue_id, title, artist_name, description?, starts_at, ends_at, planned_publish_at, gate_count(int>=1), checker_count(int>=1), press_kit_url?, ticket_types: array of { zone_code, zone_name, zone_capacity, name, price, total_quantity, max_per_user, sale_start_at, sale_end_at } (min 1) }`.
- `updateOrganizerConcertSchema`: subset của concert (`title?, description?, artist_name?, starts_at?, ends_at?, cover_image_url?` ...).
- `createDeletionRequestSchema`: `{ reason? }`.
- `listOrdersQuerySchema`: `{ cursor?, limit?, concert_id?, status? }`.

**`organizer.repository.ts`** (Prisma trực tiếp, **luôn filter theo `organizerId`**):

- `listRequests(organizerId)`, `getRequest(organizerId, requestId)`, `createRequest(organizerId, data)`.
- `listConcerts(organizerId)` — `where: { organizerId }`.
- `getOwnedConcert(organizerId, concertId)` — trả concert nếu thuộc sở hữu, kèm `status`.
- `createDeletionRequest(organizerId, concertId, reason)`.
- `listOrders(organizerId, query)` — `prisma.order.findMany({ where: { concert: { organizerId }, ...filters }, cursor })`.
- `getTicketTypeInventoryOwned(organizerId, ticketTypeId)` — join ticketType→concert, check `organizerId`, trả `{total,held,sold,available}`.
- `getConcertAnalytics(organizerId, concertId)` — aggregate: doanh thu (`sum(totalAmount)` order CONFIRMED), số vé bán (`count(Ticket)` hoặc `sum(soldQuantity)`), tỉ lệ check-in (`count(Ticket CHECKED_IN)/count(Ticket)`).
- `listCheckerAccounts(organizerId)` — `ConcertCheckerAccount` join `concert.organizerId = me`, trả email/status/concert.

**`organizer.service.ts`**:

- `submitRequest`, `listRequests`, `getRequest` — uỷ quyền repo.
- `updateConcert(organizerId, concertId, input)`: lấy `getOwnedConcert`; nếu không thuộc sở hữu → `Errors.concertNotOwnedByOrganizer`; nếu `status !== "DRAFT"` → `Errors.concertNotEditable`; rồi tái dùng `new CatalogService().updateConcert(concertId, input)` + invalidate cache.
- `requestDeletion(organizerId, concertId, reason)`: verify ownership → tạo deletion request PENDING.
- `getOrders`, `getInventory`, `getAnalytics`, `listCheckerAccounts` — verify ownership rồi gọi repo.

**`organizer.controller.ts`** — handlers, lấy `organizerId = res.locals.auth.user_id`, parse schema, gọi service, trả `ok(...)`.

**`organizer.router.ts`**:

```typescript
const organizerOnly = [requireAuth, requireRole("ORGANIZER")] as const;
organizerRouter.get(
  "/organizer/venues",
  ...organizerOnly,
  listVenuesForOrganizer,
); // tái dùng catalog list venues
organizerRouter.get("/organizer/requests", ...organizerOnly, listRequests);
organizerRouter.post("/organizer/requests", ...organizerOnly, createRequest);
organizerRouter.get(
  "/organizer/requests/:request_id",
  ...organizerOnly,
  getRequest,
);
organizerRouter.get("/organizer/concerts", ...organizerOnly, listConcerts);
organizerRouter.post(
  "/organizer/concerts/:concert_id",
  ...organizerOnly,
  updateConcert,
);
organizerRouter.post(
  "/organizer/concerts/:concert_id/deletion-requests",
  ...organizerOnly,
  createDeletionRequest,
);
organizerRouter.get(
  "/organizer/concerts/:concert_id/analytics",
  ...organizerOnly,
  getAnalytics,
);
organizerRouter.get("/organizer/orders", ...organizerOnly, listOrders);
organizerRouter.get(
  "/organizer/ticket-types/:ticket_type_id/inventory",
  ...organizerOnly,
  getInventory,
);
organizerRouter.get(
  "/organizer/checker-accounts",
  ...organizerOnly,
  listCheckerAccounts,
);
```

---

## Bước 6 — Module `organizer-admin` (routes ADMIN duyệt hồ sơ)

**File:** `apps/api-server/src/modules/organizer/organizer-admin.router.ts` + `organizer-admin.service.ts` + `organizer-admin.controller.ts`.

Routes (`adminOnly = [requireAuth, requireRole("ADMIN")]`):

```
GET  /admin/organizer-requests                       listRequests (filter ?status=)
GET  /admin/organizer-requests/:request_id           getRequest
POST /admin/organizer-requests/:request_id/approve   approveRequest
POST /admin/organizer-requests/:request_id/reject    rejectRequest (body {review_note})
GET  /admin/concert-deletion-requests                listDeletionRequests
POST /admin/concert-deletion-requests/:request_id/approve   approveDeletion
POST /admin/concert-deletion-requests/:request_id/reject    rejectDeletion
GET  /admin/concerts/:concert_id/checker-accounts    listCheckerAccountsForConcert
```

**`approveRequest(adminId, requestId)` — chạy trong `prisma.$transaction`:**

1. Lấy request, nếu `status !== PENDING` → `Errors.organizerRequestNotPending`.
2. Tạo `Concert` `{ venueId, organizerId, title, slug: slugify(title)+ngắn-random, artistName, description, startsAt, endsAt, plannedPublishAt, status: "DRAFT" }`.
3. Với mỗi `zone` distinct trong `ticket_types`: tạo `SeatZone {concertId, code, name, capacity}`.
4. Với mỗi `ticket_types[i]`: tạo `TicketType {concertId, seatZoneId(map theo zone_code), name, price, totalQuantity, maxPerUser, saleStartAt, saleEndAt}`.
5. Tạo `gate_count` `CheckinGate {concertId, code:"GATE-i", name:"Cổng i"}`.
6. Tạo `checker_count` `User {role:"CHECKER", email: checker-{slug}-{i}@ticketbox.local, passwordHash: hash(random)}`; lưu plaintext tạm vào mảng trả về **một lần**. Tạo `ConcertCheckerAccount {concertId, userId, organizerRequestId}`.
7. Update request: `status=APPROVED, reviewedById=adminId, reviewedAt=now, concertId`.
8. Trả `{ concert, checker_accounts: [{email, password}] }` (password chỉ hiện lần này).

> Tái dùng `hashPassword` từ `auth.utils.ts`. Có thể tái dùng `CatalogService.createSeatZone/createTicketType` nếu muốn validate capacity; nhưng trong transaction nên gọi prisma trực tiếp cho gọn.

**`rejectRequest`**: set `status=REJECTED, reviewNote, reviewedById, reviewedAt`.
**`approveDeletion`**: verify PENDING → `setConcertStatus(concertId,"CANCELLED")` → set request APPROVED → (Bước 7) vô hiệu checker.
**`listCheckerAccountsForConcert`**: trả email/status/created_at (không kèm password).

---

## Bước 7 — Checker tự vô hiệu khi concert kết thúc/hủy

**File:** `apps/api-server/src/modules/catalog/catalog.repository.ts` (hàm `setConcertStatus`).

Sau khi cập nhật concert sang `CANCELLED`/`COMPLETED`, trong cùng transaction: `prisma.user.updateMany({ where: { id: { in: <userIds từ ConcertCheckerAccount của concert> } }, data: { status: "DISABLED" } })`. Lấy danh sách userIds qua `ConcertCheckerAccount.findMany({where:{concertId}})`.
→ Áp dụng cho cả `cancelConcert` (admin) và `approveDeletion` (qua setConcertStatus). Nếu sau này có endpoint COMPLETED thì tự động hưởng.

---

## Bước 8 — Mount router trong `app.ts`

```typescript
import { organizerRouter } from "./modules/organizer/organizer.router.js";
import { organizerAdminRouter } from "./modules/organizer/organizer-admin.router.js";
// ...sau các app.use hiện có:
app.use("/v1", organizerRouter);
app.use("/v1", organizerAdminRouter);
```

---

## Bước 9 — Dọn dẹp & test

- Xóa import thừa ở các router đã cắt route (tránh TS error).
- Cập nhật/loại bỏ test cũ hit các route đã bỏ (tìm trong `apps/api-server/**/*.test.ts`, `*.spec.ts`, hoặc thư mục `tests/`).
- Seed: đảm bảo có sẵn vài `Venue` để organizer chọn (kiểm tra `packages/database/prisma/seed*`).
- `pnpm --filter api-server build` và `pnpm --filter api-server test`.

---

## Files tạo mới

```
apps/api-server/src/modules/organizer/organizer.schema.ts
apps/api-server/src/modules/organizer/organizer.repository.ts
apps/api-server/src/modules/organizer/organizer.service.ts
apps/api-server/src/modules/organizer/organizer.controller.ts
apps/api-server/src/modules/organizer/organizer.router.ts
apps/api-server/src/modules/organizer/organizer-admin.service.ts
apps/api-server/src/modules/organizer/organizer-admin.controller.ts
apps/api-server/src/modules/organizer/organizer-admin.router.ts
packages/database/prisma/migrations/<ts>_sprint6_organizer_request/migration.sql
```

## Files chỉnh sửa

```
packages/database/prisma/schema.prisma
apps/api-server/src/app.ts
apps/api-server/src/shared/http/problem-details.ts
apps/api-server/src/modules/auth/{auth.router,auth.controller,auth.service,auth.repository,auth.schema}.ts
apps/api-server/src/modules/catalog/catalog.router.ts
apps/api-server/src/modules/catalog/catalog.repository.ts   (setConcertStatus → disable checker)
apps/api-server/src/modules/checkin/checkin.router.ts
apps/api-server/src/modules/orders/order.router.ts
apps/api-server/src/modules/payments/payment.router.ts
apps/api-server/src/modules/tickets/ticket.router.ts
apps/api-server/src/modules/inventory/inventory.router.ts
apps/api-server/src/modules/guest-list/guest-list.router.ts
apps/api-server/src/modules/notifications/notifications.router.ts
```

---

## Verification

1. **Build & migrate:** `prisma migrate dev` chạy sạch, `prisma generate` OK, `pnpm --filter api-server build` không lỗi.
2. **Guard single-role (dùng curl/REST client với token từng role):**
   - AUDIENCE → `GET /v1/admin/concerts` = 403; `POST /v1/organizer/requests` = 403.
   - ORGANIZER → `POST /v1/admin/concerts/:id/publish` = 403; `GET /v1/organizer/concerts` = 200 (chỉ của mình).
   - CHECKER → `GET /v1/organizer/requests` = 403; `POST /v1/check-in/scan` = 200.
   - ADMIN → `GET /v1/admin/organizer-requests` = 200.
   - Route đã bỏ (vd `POST /v1/admin/concerts`, `GET /v1/guest-list/search`) → 404.
3. **Luồng end-to-end:**
   - Login mỗi role → response có `redirect_to` đúng (`/`, `/admin`, `/organizer`, `/checker`).
   - `PATCH /v1/auth/admin/users/role-by-email {email, role:"ORGANIZER"}` → 200; user đó login → `redirect_to:"/organizer"`.
   - ORGANIZER `POST /v1/organizer/requests` (đủ venue_id, ticket_types, gate_count, checker_count) → 201 PENDING.
   - ADMIN `POST /v1/admin/organizer-requests/:id/approve` → tạo Concert DRAFT + seat zones + ticket types + gates + N checker accounts; response trả mật khẩu checker 1 lần.
   - ORGANIZER `GET /v1/organizer/concerts` thấy concert DRAFT; `POST /v1/organizer/concerts/:id` sửa được khi DRAFT; `GET /v1/organizer/checker-accounts` thấy danh sách.
   - ADMIN `POST /v1/admin/concerts/:id/cancel` → checker của concert chuyển `DISABLED` (kiểm tra DB).
   - ORGANIZER `POST /v1/organizer/concerts/:id/deletion-requests` → ADMIN approve → concert `CANCELLED`.
4. **`PATCH /v1/auth/me`** đổi full_name/phone → `GET /v1/auth/me` phản ánh thay đổi.
