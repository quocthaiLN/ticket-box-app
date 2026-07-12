-- Mốc đã gửi email mời cho khách (kèm QR + sơ đồ chỗ ngồi).
-- NULL = chưa gửi; worker guest-import chỉ gửi cho guest NULL → re-import không gửi trùng.
ALTER TABLE "guest_list" ADD COLUMN "invite_email_sent_at" TIMESTAMP(3);
