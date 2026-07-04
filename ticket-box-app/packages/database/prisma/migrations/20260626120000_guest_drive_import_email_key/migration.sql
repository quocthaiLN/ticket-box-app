-- Guest List import CSV qua Google Drive + khử trùng khách mời theo email.

-- 1) Concert: thư mục Google Drive chứa file CSV khách mời VIP (BTC tự quản lý).
ALTER TABLE "concerts" ADD COLUMN "guest_drive_folder_id" TEXT;

-- 2) guest_list: email trở thành danh tính khử trùng (NOT NULL); phone chuyển sang tùy chọn.
--    Xoá ràng buộc trùng cũ theo (concert_id, phone).
DROP INDEX IF EXISTS "guest_list_concert_id_phone_key";

ALTER TABLE "guest_list" ALTER COLUMN "phone" DROP NOT NULL;

-- Hàng email NULL không hợp lệ theo mô hình mới → dọn trước khi đặt NOT NULL (dev DB thường trống).
DELETE FROM "guest_list" WHERE "email" IS NULL;

ALTER TABLE "guest_list" ALTER COLUMN "email" SET NOT NULL;

-- Ràng buộc trùng mới: mỗi concert một email duy nhất.
CREATE UNIQUE INDEX "guest_list_concert_id_email_key" ON "guest_list"("concert_id", "email");
