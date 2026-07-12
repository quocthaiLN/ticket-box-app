-- Tách sơ đồ chỗ ngồi thành 2 asset:
--   seat_map_url        = file SVG tương tác (chỉ trang mua vé)
--   seat_map_image_url  = ảnh PNG/JPEG (trang thông tin concert + email mời)
ALTER TABLE "concerts" ADD COLUMN "seat_map_image_url" TEXT;
ALTER TABLE "organizer_requests" ADD COLUMN "seat_map_image_url" TEXT;

-- Backfill: bản ghi cũ có seat_map_url không phải .svg là ảnh raster →
-- chuyển sang seat_map_image_url, seat_map_url chỉ giữ SVG.
UPDATE "concerts"
SET "seat_map_image_url" = "seat_map_url", "seat_map_url" = NULL
WHERE "seat_map_url" IS NOT NULL AND "seat_map_url" !~* '\.svg([?#].*)?$';

UPDATE "organizer_requests"
SET "seat_map_image_url" = "seat_map_url", "seat_map_url" = NULL
WHERE "seat_map_url" IS NOT NULL AND "seat_map_url" !~* '\.svg([?#].*)?$';
