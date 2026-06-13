ALTER TYPE "offline_item_status" ADD VALUE IF NOT EXISTS 'SUCCESS';
ALTER TYPE "offline_item_status" ADD VALUE IF NOT EXISTS 'ALREADY_CHECKED_IN';
ALTER TYPE "offline_item_status" ADD VALUE IF NOT EXISTS 'INVALID_TICKET';
ALTER TYPE "offline_item_status" ADD VALUE IF NOT EXISTS 'INVALID_GUEST';
ALTER TYPE "offline_item_status" ADD VALUE IF NOT EXISTS 'DUPLICATE_ITEM';

ALTER TABLE "guest_import_jobs"
  ADD COLUMN IF NOT EXISTS "skipped_rows" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "offline_checkin_items"
  ADD COLUMN IF NOT EXISTS "client_item_id" VARCHAR(128);

CREATE UNIQUE INDEX IF NOT EXISTS "offline_checkin_items_batch_id_client_item_id_key"
  ON "offline_checkin_items"("batch_id", "client_item_id");

ALTER TABLE "offline_checkin_items"
  DROP CONSTRAINT IF EXISTS "ck_offline_items_has_target";

ALTER TABLE "offline_checkin_items"
  ADD CONSTRAINT "ck_offline_items_has_target" CHECK (
    "qr_token_hash" IS NOT NULL
    OR "ticket_id" IS NOT NULL
    OR "guest_id" IS NOT NULL
    OR "client_item_id" IS NOT NULL
  );

ALTER TABLE "guest_import_jobs"
  DROP CONSTRAINT IF EXISTS "ck_guest_import_counts_non_negative";

ALTER TABLE "guest_import_jobs"
  ADD CONSTRAINT "ck_guest_import_counts_non_negative" CHECK (
    "total_rows" >= 0
    AND "success_rows" >= 0
    AND "error_rows" >= 0
    AND "skipped_rows" >= 0
  );
