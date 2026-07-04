DO $$
BEGIN
  CREATE TYPE "approval_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "concerts"
  ADD COLUMN IF NOT EXISTS "planned_publish_at" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "organizer_requests" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizer_id" UUID NOT NULL,
  "venue_id" UUID NOT NULL,
  "title" VARCHAR(255) NOT NULL,
  "artist_name" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "starts_at" TIMESTAMP(3) NOT NULL,
  "ends_at" TIMESTAMP(3) NOT NULL,
  "planned_publish_at" TIMESTAMP(3),
  "gate_count" INTEGER NOT NULL DEFAULT 1,
  "checker_count" INTEGER NOT NULL DEFAULT 1,
  "press_kit_url" TEXT,
  "ticket_types" JSONB NOT NULL,
  "status" "approval_status" NOT NULL DEFAULT 'PENDING',
  "reviewed_by" UUID,
  "reviewed_at" TIMESTAMP(3),
  "review_note" TEXT,
  "concert_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "organizer_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "concert_deletion_requests" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "concert_id" UUID NOT NULL,
  "organizer_id" UUID NOT NULL,
  "reason" TEXT,
  "status" "approval_status" NOT NULL DEFAULT 'PENDING',
  "reviewed_by" UUID,
  "reviewed_at" TIMESTAMP(3),
  "review_note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "concert_deletion_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "concert_checker_accounts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "concert_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "organizer_request_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "concert_checker_accounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "organizer_requests_concert_id_key"
  ON "organizer_requests"("concert_id");
CREATE INDEX IF NOT EXISTS "organizer_requests_organizer_id_status_created_at_idx"
  ON "organizer_requests"("organizer_id", "status", "created_at");
CREATE INDEX IF NOT EXISTS "organizer_requests_status_created_at_idx"
  ON "organizer_requests"("status", "created_at");
CREATE INDEX IF NOT EXISTS "organizer_requests_venue_id_idx"
  ON "organizer_requests"("venue_id");
CREATE INDEX IF NOT EXISTS "organizer_requests_reviewed_by_idx"
  ON "organizer_requests"("reviewed_by");

CREATE INDEX IF NOT EXISTS "concert_deletion_requests_concert_id_status_idx"
  ON "concert_deletion_requests"("concert_id", "status");
CREATE INDEX IF NOT EXISTS "concert_deletion_requests_organizer_id_status_created_at_idx"
  ON "concert_deletion_requests"("organizer_id", "status", "created_at");
CREATE INDEX IF NOT EXISTS "concert_deletion_requests_status_created_at_idx"
  ON "concert_deletion_requests"("status", "created_at");
CREATE INDEX IF NOT EXISTS "concert_deletion_requests_reviewed_by_idx"
  ON "concert_deletion_requests"("reviewed_by");

CREATE UNIQUE INDEX IF NOT EXISTS "concert_checker_accounts_concert_id_user_id_key"
  ON "concert_checker_accounts"("concert_id", "user_id");
CREATE INDEX IF NOT EXISTS "concert_checker_accounts_user_id_idx"
  ON "concert_checker_accounts"("user_id");
CREATE INDEX IF NOT EXISTS "concert_checker_accounts_organizer_request_id_idx"
  ON "concert_checker_accounts"("organizer_request_id");

ALTER TABLE "organizer_requests"
  ADD CONSTRAINT "organizer_requests_organizer_id_fkey"
  FOREIGN KEY ("organizer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "organizer_requests"
  ADD CONSTRAINT "organizer_requests_venue_id_fkey"
  FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "organizer_requests"
  ADD CONSTRAINT "organizer_requests_reviewed_by_fkey"
  FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "organizer_requests"
  ADD CONSTRAINT "organizer_requests_concert_id_fkey"
  FOREIGN KEY ("concert_id") REFERENCES "concerts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "concert_deletion_requests"
  ADD CONSTRAINT "concert_deletion_requests_concert_id_fkey"
  FOREIGN KEY ("concert_id") REFERENCES "concerts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "concert_deletion_requests"
  ADD CONSTRAINT "concert_deletion_requests_organizer_id_fkey"
  FOREIGN KEY ("organizer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "concert_deletion_requests"
  ADD CONSTRAINT "concert_deletion_requests_reviewed_by_fkey"
  FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "concert_checker_accounts"
  ADD CONSTRAINT "concert_checker_accounts_concert_id_fkey"
  FOREIGN KEY ("concert_id") REFERENCES "concerts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "concert_checker_accounts"
  ADD CONSTRAINT "concert_checker_accounts_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "concert_checker_accounts"
  ADD CONSTRAINT "concert_checker_accounts_organizer_request_id_fkey"
  FOREIGN KEY ("organizer_request_id") REFERENCES "organizer_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "organizer_requests"
  ADD CONSTRAINT "ck_organizer_requests_time_range" CHECK ("ends_at" > "starts_at"),
  ADD CONSTRAINT "ck_organizer_requests_gate_count_positive" CHECK ("gate_count" >= 1),
  ADD CONSTRAINT "ck_organizer_requests_checker_count_positive" CHECK ("checker_count" >= 1),
  ADD CONSTRAINT "ck_organizer_requests_ticket_types_array" CHECK (jsonb_typeof("ticket_types") = 'array');

DROP TRIGGER IF EXISTS "trg_organizer_requests_set_updated_at" ON "organizer_requests";
CREATE TRIGGER "trg_organizer_requests_set_updated_at"
  BEFORE UPDATE ON "organizer_requests"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS "trg_concert_deletion_requests_set_updated_at" ON "concert_deletion_requests";
CREATE TRIGGER "trg_concert_deletion_requests_set_updated_at"
  BEFORE UPDATE ON "concert_deletion_requests"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS "trg_concert_checker_accounts_set_updated_at" ON "concert_checker_accounts";
CREATE TRIGGER "trg_concert_checker_accounts_set_updated_at"
  BEFORE UPDATE ON "concert_checker_accounts"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
