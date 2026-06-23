-- Mỗi vé chỉ được vào đúng 1 cổng: thêm gate_id (bắt buộc) vào tickets và gắn FK
-- tới checkin_gates theo cặp (gate_id, concert_id) như các quan hệ composite khác.

-- 1) Thêm cột nullable trước để có thể backfill dữ liệu vé hiện có.
ALTER TABLE "tickets"
  ADD COLUMN IF NOT EXISTS "gate_id" UUID;

-- 2) Backfill: gán mỗi vé một cổng active của khu ghế (chọn theo sort_order).
--    seat_zone_id là duy nhất theo concert nên đủ để suy ra concert tương ứng.
UPDATE "tickets" t
SET "gate_id" = sub."gate_id"
FROM (
  SELECT DISTINCT ON (cgz."seat_zone_id")
    cgz."seat_zone_id",
    cgz."gate_id"
  FROM "checkin_gate_zones" cgz
  JOIN "checkin_gates" cg
    ON cg."id" = cgz."gate_id" AND cg."concert_id" = cgz."concert_id"
  WHERE cg."is_active" = true
  ORDER BY cgz."seat_zone_id", cg."sort_order" ASC, cg."id" ASC
) sub
WHERE t."seat_zone_id" = sub."seat_zone_id"
  AND t."gate_id" IS NULL;

-- 3) Sau khi backfill, bắt buộc NOT NULL.
ALTER TABLE "tickets"
  ALTER COLUMN "gate_id" SET NOT NULL;

-- 4) FK composite (gate_id, concert_id) -> checkin_gates(id, concert_id).
ALTER TABLE "tickets"
  DROP CONSTRAINT IF EXISTS "tickets_gate_id_concert_id_fkey";
ALTER TABLE "tickets"
  ADD CONSTRAINT "tickets_gate_id_concert_id_fkey"
  FOREIGN KEY ("gate_id", "concert_id")
  REFERENCES "checkin_gates"("id", "concert_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- 5) Index tra cứu vé theo cổng.
CREATE INDEX IF NOT EXISTS "tickets_gate_id_idx" ON "tickets"("gate_id");
