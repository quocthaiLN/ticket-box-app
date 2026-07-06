-- Phương án A multi-artist: danh sách nghệ sĩ [{name, bio, image_url}] dạng JSONB.
-- NULL với dữ liệu cũ — hiển thị fallback theo artist_bio/artist_bio_image_url đơn.
ALTER TABLE "concerts" ADD COLUMN "artists" JSONB;
ALTER TABLE "organizer_requests" ADD COLUMN "artists" JSONB;
