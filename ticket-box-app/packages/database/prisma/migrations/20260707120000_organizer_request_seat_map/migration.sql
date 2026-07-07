-- Ảnh sơ đồ chỗ ngồi organizer upload khi nộp hồ sơ; copy sang concert khi approve.
ALTER TABLE "organizer_requests" ADD COLUMN "seat_map_url" TEXT;
