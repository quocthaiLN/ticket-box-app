-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('active', 'locked', 'disabled');

-- CreateEnum
CREATE TYPE "concert_status" AS ENUM ('draft', 'published', 'cancelled', 'completed');

-- CreateEnum
CREATE TYPE "ticket_type_status" AS ENUM ('draft', 'on_sale', 'sold_out', 'closed');

-- CreateEnum
CREATE TYPE "reservation_status" AS ENUM ('held', 'confirmed', 'released', 'expired', 'cancelled');

-- CreateEnum
CREATE TYPE "inventory_event_type" AS ENUM ('hold', 'release', 'payment_confirmed', 'refund', 'admin_adjust');

-- CreateEnum
CREATE TYPE "order_status" AS ENUM ('pending', 'awaiting_payment', 'paid', 'cancelled', 'expired', 'failed');

-- CreateEnum
CREATE TYPE "payment_provider" AS ENUM ('vnpay', 'momo');

-- CreateEnum
CREATE TYPE "payment_status" AS ENUM ('pending', 'success', 'failed', 'timeout', 'refunded');

-- CreateEnum
CREATE TYPE "ticket_status" AS ENUM ('issued', 'checked_in', 'cancelled', 'refunded');

-- CreateEnum
CREATE TYPE "device_status" AS ENUM ('active', 'revoked', 'lost');

-- CreateEnum
CREATE TYPE "notification_type" AS ENUM ('system', 'order_confirmed', 'payment_failed', 'ticket_issued', 'concert_updated', 'checkin_alert');

-- CreateEnum
CREATE TYPE "notification_priority" AS ENUM ('low', 'normal', 'high', 'urgent');

-- CreateEnum
CREATE TYPE "notification_channel" AS ENUM ('in_app', 'email', 'sms', 'push');

-- CreateEnum
CREATE TYPE "notification_delivery_status" AS ENUM ('pending', 'sending', 'sent', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "artist_bio_job_status" AS ENUM ('pending', 'processing', 'done', 'failed');

-- CreateEnum
CREATE TYPE "import_status" AS ENUM ('pending', 'processing', 'done', 'failed', 'partial');

-- CreateEnum
CREATE TYPE "guest_status" AS ENUM ('invited', 'checked_in', 'cancelled');

-- CreateEnum
CREATE TYPE "checkin_result" AS ENUM ('success', 'already_checked_in', 'invalid_ticket', 'invalid_guest', 'wrong_concert', 'wrong_gate', 'conflict', 'error');

-- CreateEnum
CREATE TYPE "offline_batch_status" AS ENUM ('pending', 'syncing', 'done', 'failed');

-- CreateEnum
CREATE TYPE "offline_item_status" AS ENUM ('pending', 'accepted', 'conflict', 'invalid', 'wrong_gate', 'error');

-- CreateEnum
CREATE TYPE "idempotency_status" AS ENUM ('processing', 'succeeded', 'failed');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" VARCHAR(255),
    "phone" VARCHAR(20),
    "status" "user_status" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "artists" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "bio" TEXT,
    "image_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "artists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "artist_bio_jobs" (
    "id" UUID NOT NULL,
    "artist_id" UUID NOT NULL,
    "uploaded_by" UUID,
    "source_file_url" TEXT NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "file_size_bytes" BIGINT NOT NULL,
    "status" "artist_bio_job_status" NOT NULL DEFAULT 'pending',
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "artist_bio_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "artist_bios" (
    "id" UUID NOT NULL,
    "artist_id" UUID NOT NULL,
    "job_id" UUID,
    "bio_text" TEXT NOT NULL,
    "language" CHAR(2) NOT NULL DEFAULT 'vi',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "artist_bios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concert_artists" (
    "concert_id" UUID NOT NULL,
    "artist_id" UUID NOT NULL,
    "role" VARCHAR(100),
    "billing_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "concert_artists_pkey" PRIMARY KEY ("concert_id","artist_id")
);

-- CreateTable
CREATE TABLE "concerts" (
    "id" UUID NOT NULL,
    "venue_id" UUID NOT NULL,
    "organizer_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "status" "concert_status" NOT NULL DEFAULT 'draft',
    "cover_image_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "concerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venues" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "address" TEXT NOT NULL,
    "city" VARCHAR(100) NOT NULL,
    "capacity" INTEGER,
    "map_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "venues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venue_zones" (
    "id" UUID NOT NULL,
    "venue_id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "capacity" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "venue_zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seat_maps" (
    "id" UUID NOT NULL,
    "venue_id" UUID NOT NULL,
    "concert_id" UUID,
    "name" VARCHAR(150) NOT NULL,
    "svg_text" TEXT,
    "asset_url" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "seat_maps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gates" (
    "id" UUID NOT NULL,
    "venue_id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "gates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gate_zones" (
    "gate_id" UUID NOT NULL,
    "zone_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gate_zones_pkey" PRIMARY KEY ("gate_id","zone_id")
);

-- CreateTable
CREATE TABLE "checkin_devices" (
    "id" UUID NOT NULL,
    "device_code" VARCHAR(100) NOT NULL,
    "staff_id" UUID,
    "concert_id" UUID,
    "gate_id" UUID,
    "public_key" TEXT,
    "status" "device_status" NOT NULL DEFAULT 'active',
    "last_sync_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checkin_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checkin_sessions" (
    "id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "staff_id" UUID,
    "concert_id" UUID NOT NULL,
    "gate_id" UUID NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checkin_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_types" (
    "id" UUID NOT NULL,
    "concert_id" UUID NOT NULL,
    "zone_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "price" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'VND',
    "total_quantity" INTEGER NOT NULL,
    "max_per_user" INTEGER NOT NULL,
    "sale_start_at" TIMESTAMP(3) NOT NULL,
    "sale_end_at" TIMESTAMP(3) NOT NULL,
    "status" "ticket_type_status" NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "ticket_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_inventories" (
    "ticket_type_id" UUID NOT NULL,
    "total" INTEGER NOT NULL,
    "available" INTEGER NOT NULL,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "sold" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_inventories_pkey" PRIMARY KEY ("ticket_type_id")
);

-- CreateTable
CREATE TABLE "inventory_reservations" (
    "id" UUID NOT NULL,
    "ticket_type_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "order_id" UUID,
    "quantity" INTEGER NOT NULL,
    "status" "reservation_status" NOT NULL DEFAULT 'held',
    "idempotency_key" VARCHAR(128),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "confirmed_at" TIMESTAMP(3),
    "released_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_ticket_type_counters" (
    "user_id" UUID NOT NULL,
    "ticket_type_id" UUID NOT NULL,
    "held_quantity" INTEGER NOT NULL DEFAULT 0,
    "paid_quantity" INTEGER NOT NULL DEFAULT 0,
    "refunded_quantity" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_ticket_type_counters_pkey" PRIMARY KEY ("user_id","ticket_type_id")
);

-- CreateTable
CREATE TABLE "ticket_inventory_events" (
    "id" UUID NOT NULL,
    "ticket_type_id" UUID NOT NULL,
    "order_id" UUID,
    "reservation_id" UUID,
    "event_type" "inventory_event_type" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "before_total" INTEGER,
    "after_total" INTEGER,
    "before_available" INTEGER,
    "after_available" INTEGER,
    "before_reserved" INTEGER,
    "after_reserved" INTEGER,
    "before_sold" INTEGER,
    "after_sold" INTEGER,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_inventory_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "concert_id" UUID NOT NULL,
    "idempotency_key" VARCHAR(128),
    "status" "order_status" NOT NULL DEFAULT 'pending',
    "total_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" CHAR(3) NOT NULL DEFAULT 'VND',
    "hold_expires_at" TIMESTAMP(3),
    "cancelled_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "ticket_type_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "line_total" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "provider" "payment_provider" NOT NULL,
    "provider_transaction_id" VARCHAR(255),
    "idempotency_key" VARCHAR(128),
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'VND',
    "status" "payment_status" NOT NULL DEFAULT 'pending',
    "provider_payload" JSONB,
    "paid_at" TIMESTAMP(3),
    "failure_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "order_item_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "concert_id" UUID NOT NULL,
    "ticket_type_id" UUID NOT NULL,
    "zone_id" UUID NOT NULL,
    "qr_token_hash" VARCHAR(255) NOT NULL,
    "qr_payload" JSONB,
    "qr_signature" TEXT,
    "status" "ticket_status" NOT NULL DEFAULT 'issued',
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checked_in_at" TIMESTAMP(3),
    "checked_in_by_id" UUID,
    "cancelled_at" TIMESTAMP(3),
    "refunded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "actor_id" UUID,
    "concert_id" UUID,
    "order_id" UUID,
    "ticket_id" UUID,
    "type" "notification_type" NOT NULL,
    "priority" "notification_priority" NOT NULL DEFAULT 'normal',
    "title" VARCHAR(255) NOT NULL,
    "body" TEXT,
    "action_url" TEXT,
    "metadata" JSONB,
    "read_at" TIMESTAMP(3),
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_deliveries" (
    "id" UUID NOT NULL,
    "notification_id" UUID NOT NULL,
    "channel" "notification_channel" NOT NULL,
    "recipient" VARCHAR(255),
    "status" "notification_delivery_status" NOT NULL DEFAULT 'pending',
    "provider" VARCHAR(50),
    "provider_message_id" VARCHAR(255),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_attempt_at" TIMESTAMP(3),
    "next_attempt_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "failure_reason" TEXT,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guest_import_jobs" (
    "id" UUID NOT NULL,
    "concert_id" UUID NOT NULL,
    "uploaded_by" UUID,
    "source_file_url" TEXT,
    "source_file_name" VARCHAR(255),
    "status" "import_status" NOT NULL DEFAULT 'pending',
    "total_rows" INTEGER NOT NULL DEFAULT 0,
    "success_rows" INTEGER NOT NULL DEFAULT 0,
    "error_rows" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guest_import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guest_list" (
    "id" UUID NOT NULL,
    "concert_id" UUID NOT NULL,
    "zone_id" UUID,
    "full_name" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "email" VARCHAR(255),
    "sponsor_name" VARCHAR(255),
    "status" "guest_status" NOT NULL DEFAULT 'invited',
    "checked_in_at" TIMESTAMP(3),
    "checked_in_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guest_list_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guest_import_errors" (
    "id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "row_number" INTEGER NOT NULL,
    "raw_data" JSONB,
    "error_message" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guest_import_errors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checkin_logs" (
    "id" UUID NOT NULL,
    "ticket_id" UUID,
    "guest_id" UUID,
    "concert_id" UUID NOT NULL,
    "zone_id" UUID,
    "gate_id" UUID,
    "device_id" UUID,
    "staff_id" UUID,
    "gate_code" VARCHAR(50),
    "device_code" VARCHAR(100),
    "scan_token_hash" VARCHAR(255),
    "result" "checkin_result" NOT NULL,
    "reason" TEXT,
    "scanned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "synced_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checkin_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offline_checkin_batches" (
    "id" UUID NOT NULL,
    "concert_id" UUID NOT NULL,
    "staff_id" UUID,
    "device_id" UUID NOT NULL,
    "gate_id" UUID,
    "batch_token" VARCHAR(128) NOT NULL,
    "status" "offline_batch_status" NOT NULL DEFAULT 'pending',
    "item_count" INTEGER NOT NULL DEFAULT 0,
    "conflict_count" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3) NOT NULL,
    "synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "offline_checkin_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offline_checkin_items" (
    "id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "ticket_id" UUID,
    "guest_id" UUID,
    "zone_id" UUID,
    "gate_id" UUID,
    "qr_token_hash" VARCHAR(255),
    "local_scanned_at" TIMESTAMP(3) NOT NULL,
    "sync_result" "offline_item_status" NOT NULL DEFAULT 'pending',
    "conflict_reason" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "offline_checkin_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_user_id" UUID,
    "action" VARCHAR(100) NOT NULL,
    "entity_type" VARCHAR(100) NOT NULL,
    "entity_id" UUID,
    "before_data" JSONB,
    "after_data" JSONB,
    "ip_address" INET,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limit_buckets" (
    "id" UUID NOT NULL,
    "key" VARCHAR(255) NOT NULL,
    "scope" VARCHAR(100) NOT NULL,
    "identifier" VARCHAR(255) NOT NULL,
    "route" VARCHAR(255),
    "tokens_remaining" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "max_tokens" INTEGER NOT NULL,
    "refill_rate" DECIMAL(12,4) NOT NULL,
    "last_refill_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "blocked_until" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rate_limit_buckets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "order_id" UUID,
    "key" VARCHAR(128) NOT NULL,
    "request_hash" VARCHAR(128) NOT NULL,
    "status" "idempotency_status" NOT NULL DEFAULT 'processing',
    "response_code" INTEGER,
    "response_body" JSONB,
    "locked_until" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE INDEX "user_roles_role_id_idx" ON "user_roles"("role_id");

-- CreateIndex
CREATE INDEX "role_permissions_permission_id_idx" ON "role_permissions"("permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "artists_slug_key" ON "artists"("slug");

-- CreateIndex
CREATE INDEX "artists_name_idx" ON "artists"("name");

-- CreateIndex
CREATE INDEX "artist_bio_jobs_artist_id_status_idx" ON "artist_bio_jobs"("artist_id", "status");

-- CreateIndex
CREATE INDEX "artist_bio_jobs_status_created_at_idx" ON "artist_bio_jobs"("status", "created_at");

-- CreateIndex
CREATE INDEX "artist_bio_jobs_uploaded_by_idx" ON "artist_bio_jobs"("uploaded_by");

-- CreateIndex
CREATE INDEX "artist_bios_artist_id_is_active_idx" ON "artist_bios"("artist_id", "is_active");

-- CreateIndex
CREATE INDEX "artist_bios_job_id_idx" ON "artist_bios"("job_id");

-- CreateIndex
CREATE INDEX "concert_artists_artist_id_idx" ON "concert_artists"("artist_id");

-- CreateIndex
CREATE UNIQUE INDEX "concerts_slug_key" ON "concerts"("slug");

-- CreateIndex
CREATE INDEX "concerts_venue_id_idx" ON "concerts"("venue_id");

-- CreateIndex
CREATE INDEX "concerts_organizer_id_idx" ON "concerts"("organizer_id");

-- CreateIndex
CREATE INDEX "concerts_status_starts_at_idx" ON "concerts"("status", "starts_at");

-- CreateIndex
CREATE INDEX "venues_city_idx" ON "venues"("city");

-- CreateIndex
CREATE INDEX "venue_zones_venue_id_idx" ON "venue_zones"("venue_id");

-- CreateIndex
CREATE UNIQUE INDEX "venue_zones_venue_id_code_key" ON "venue_zones"("venue_id", "code");

-- CreateIndex
CREATE INDEX "seat_maps_venue_id_idx" ON "seat_maps"("venue_id");

-- CreateIndex
CREATE INDEX "seat_maps_concert_id_idx" ON "seat_maps"("concert_id");

-- CreateIndex
CREATE INDEX "seat_maps_venue_id_is_active_idx" ON "seat_maps"("venue_id", "is_active");

-- CreateIndex
CREATE INDEX "gates_venue_id_is_active_idx" ON "gates"("venue_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "gates_venue_id_code_key" ON "gates"("venue_id", "code");

-- CreateIndex
CREATE INDEX "gate_zones_zone_id_idx" ON "gate_zones"("zone_id");

-- CreateIndex
CREATE UNIQUE INDEX "checkin_devices_device_code_key" ON "checkin_devices"("device_code");

-- CreateIndex
CREATE INDEX "checkin_devices_staff_id_status_idx" ON "checkin_devices"("staff_id", "status");

-- CreateIndex
CREATE INDEX "checkin_devices_concert_id_gate_id_status_idx" ON "checkin_devices"("concert_id", "gate_id", "status");

-- CreateIndex
CREATE INDEX "checkin_sessions_device_id_is_active_idx" ON "checkin_sessions"("device_id", "is_active");

-- CreateIndex
CREATE INDEX "checkin_sessions_staff_id_idx" ON "checkin_sessions"("staff_id");

-- CreateIndex
CREATE INDEX "checkin_sessions_concert_id_gate_id_idx" ON "checkin_sessions"("concert_id", "gate_id");

-- CreateIndex
CREATE INDEX "ticket_types_concert_id_status_idx" ON "ticket_types"("concert_id", "status");

-- CreateIndex
CREATE INDEX "ticket_types_zone_id_idx" ON "ticket_types"("zone_id");

-- CreateIndex
CREATE INDEX "ticket_types_sale_start_at_sale_end_at_idx" ON "ticket_types"("sale_start_at", "sale_end_at");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_types_concert_id_code_key" ON "ticket_types"("concert_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_reservations_idempotency_key_key" ON "inventory_reservations"("idempotency_key");

-- CreateIndex
CREATE INDEX "inventory_reservations_ticket_type_id_status_idx" ON "inventory_reservations"("ticket_type_id", "status");

-- CreateIndex
CREATE INDEX "inventory_reservations_user_id_status_idx" ON "inventory_reservations"("user_id", "status");

-- CreateIndex
CREATE INDEX "inventory_reservations_order_id_idx" ON "inventory_reservations"("order_id");

-- CreateIndex
CREATE INDEX "inventory_reservations_expires_at_idx" ON "inventory_reservations"("expires_at");

-- CreateIndex
CREATE INDEX "user_ticket_type_counters_ticket_type_id_idx" ON "user_ticket_type_counters"("ticket_type_id");

-- CreateIndex
CREATE INDEX "ticket_inventory_events_ticket_type_id_created_at_idx" ON "ticket_inventory_events"("ticket_type_id", "created_at");

-- CreateIndex
CREATE INDEX "ticket_inventory_events_order_id_idx" ON "ticket_inventory_events"("order_id");

-- CreateIndex
CREATE INDEX "ticket_inventory_events_reservation_id_idx" ON "ticket_inventory_events"("reservation_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_idempotency_key_key" ON "orders"("idempotency_key");

-- CreateIndex
CREATE INDEX "orders_user_id_status_created_at_idx" ON "orders"("user_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "orders_concert_id_status_idx" ON "orders"("concert_id", "status");

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");

-- CreateIndex
CREATE INDEX "order_items_ticket_type_id_idx" ON "order_items"("ticket_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_idempotency_key_key" ON "payments"("idempotency_key");

-- CreateIndex
CREATE INDEX "payments_order_id_status_idx" ON "payments"("order_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "payments_provider_provider_transaction_id_key" ON "payments"("provider", "provider_transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_qr_token_hash_key" ON "tickets"("qr_token_hash");

-- CreateIndex
CREATE INDEX "tickets_order_id_idx" ON "tickets"("order_id");

-- CreateIndex
CREATE INDEX "tickets_order_item_id_idx" ON "tickets"("order_item_id");

-- CreateIndex
CREATE INDEX "tickets_user_id_idx" ON "tickets"("user_id");

-- CreateIndex
CREATE INDEX "tickets_concert_id_idx" ON "tickets"("concert_id");

-- CreateIndex
CREATE INDEX "tickets_zone_id_idx" ON "tickets"("zone_id");

-- CreateIndex
CREATE INDEX "tickets_user_id_concert_id_status_idx" ON "tickets"("user_id", "concert_id", "status");

-- CreateIndex
CREATE INDEX "tickets_ticket_type_id_status_idx" ON "tickets"("ticket_type_id", "status");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_created_at_idx" ON "notifications"("user_id", "read_at", "created_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_archived_at_created_at_idx" ON "notifications"("user_id", "archived_at", "created_at");

-- CreateIndex
CREATE INDEX "notifications_type_created_at_idx" ON "notifications"("type", "created_at");

-- CreateIndex
CREATE INDEX "notifications_concert_id_idx" ON "notifications"("concert_id");

-- CreateIndex
CREATE INDEX "notifications_order_id_idx" ON "notifications"("order_id");

-- CreateIndex
CREATE INDEX "notifications_ticket_id_idx" ON "notifications"("ticket_id");

-- CreateIndex
CREATE INDEX "notification_deliveries_channel_status_next_attempt_at_idx" ON "notification_deliveries"("channel", "status", "next_attempt_at");

-- CreateIndex
CREATE INDEX "notification_deliveries_status_created_at_idx" ON "notification_deliveries"("status", "created_at");

-- CreateIndex
CREATE INDEX "notification_deliveries_provider_provider_message_id_idx" ON "notification_deliveries"("provider", "provider_message_id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_deliveries_notification_id_channel_key" ON "notification_deliveries"("notification_id", "channel");

-- CreateIndex
CREATE INDEX "guest_import_jobs_concert_id_status_idx" ON "guest_import_jobs"("concert_id", "status");

-- CreateIndex
CREATE INDEX "guest_import_jobs_uploaded_by_idx" ON "guest_import_jobs"("uploaded_by");

-- CreateIndex
CREATE INDEX "guest_import_jobs_status_created_at_idx" ON "guest_import_jobs"("status", "created_at");

-- CreateIndex
CREATE INDEX "guest_list_concert_id_status_idx" ON "guest_list"("concert_id", "status");

-- CreateIndex
CREATE INDEX "guest_list_zone_id_idx" ON "guest_list"("zone_id");

-- CreateIndex
CREATE INDEX "guest_list_checked_in_by_id_idx" ON "guest_list"("checked_in_by_id");

-- CreateIndex
CREATE INDEX "guest_list_phone_idx" ON "guest_list"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "guest_list_concert_id_phone_key" ON "guest_list"("concert_id", "phone");

-- CreateIndex
CREATE INDEX "guest_import_errors_job_id_row_number_idx" ON "guest_import_errors"("job_id", "row_number");

-- CreateIndex
CREATE INDEX "checkin_logs_ticket_id_scanned_at_idx" ON "checkin_logs"("ticket_id", "scanned_at");

-- CreateIndex
CREATE INDEX "checkin_logs_guest_id_scanned_at_idx" ON "checkin_logs"("guest_id", "scanned_at");

-- CreateIndex
CREATE INDEX "checkin_logs_concert_id_scanned_at_idx" ON "checkin_logs"("concert_id", "scanned_at");

-- CreateIndex
CREATE INDEX "checkin_logs_gate_id_scanned_at_idx" ON "checkin_logs"("gate_id", "scanned_at");

-- CreateIndex
CREATE INDEX "checkin_logs_device_id_scanned_at_idx" ON "checkin_logs"("device_id", "scanned_at");

-- CreateIndex
CREATE INDEX "checkin_logs_staff_id_scanned_at_idx" ON "checkin_logs"("staff_id", "scanned_at");

-- CreateIndex
CREATE INDEX "checkin_logs_result_scanned_at_idx" ON "checkin_logs"("result", "scanned_at");

-- CreateIndex
CREATE UNIQUE INDEX "offline_checkin_batches_batch_token_key" ON "offline_checkin_batches"("batch_token");

-- CreateIndex
CREATE INDEX "offline_checkin_batches_concert_id_status_idx" ON "offline_checkin_batches"("concert_id", "status");

-- CreateIndex
CREATE INDEX "offline_checkin_batches_device_id_status_idx" ON "offline_checkin_batches"("device_id", "status");

-- CreateIndex
CREATE INDEX "offline_checkin_batches_gate_id_status_idx" ON "offline_checkin_batches"("gate_id", "status");

-- CreateIndex
CREATE INDEX "offline_checkin_batches_staff_id_idx" ON "offline_checkin_batches"("staff_id");

-- CreateIndex
CREATE INDEX "offline_checkin_batches_status_created_at_idx" ON "offline_checkin_batches"("status", "created_at");

-- CreateIndex
CREATE INDEX "offline_checkin_items_batch_id_sync_result_idx" ON "offline_checkin_items"("batch_id", "sync_result");

-- CreateIndex
CREATE INDEX "offline_checkin_items_ticket_id_idx" ON "offline_checkin_items"("ticket_id");

-- CreateIndex
CREATE INDEX "offline_checkin_items_guest_id_idx" ON "offline_checkin_items"("guest_id");

-- CreateIndex
CREATE INDEX "offline_checkin_items_zone_id_idx" ON "offline_checkin_items"("zone_id");

-- CreateIndex
CREATE INDEX "offline_checkin_items_gate_id_sync_result_idx" ON "offline_checkin_items"("gate_id", "sync_result");

-- CreateIndex
CREATE INDEX "offline_checkin_items_local_scanned_at_idx" ON "offline_checkin_items"("local_scanned_at");

-- CreateIndex
CREATE UNIQUE INDEX "offline_checkin_items_batch_id_qr_token_hash_key" ON "offline_checkin_items"("batch_id", "qr_token_hash");

-- CreateIndex
CREATE INDEX "audit_logs_actor_user_id_created_at_idx" ON "audit_logs"("actor_user_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_created_at_idx" ON "audit_logs"("entity_type", "entity_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "rate_limit_buckets_key_key" ON "rate_limit_buckets"("key");

-- CreateIndex
CREATE INDEX "rate_limit_buckets_scope_identifier_idx" ON "rate_limit_buckets"("scope", "identifier");

-- CreateIndex
CREATE INDEX "rate_limit_buckets_route_idx" ON "rate_limit_buckets"("route");

-- CreateIndex
CREATE INDEX "rate_limit_buckets_expires_at_idx" ON "rate_limit_buckets"("expires_at");

-- CreateIndex
CREATE INDEX "rate_limit_buckets_blocked_until_idx" ON "rate_limit_buckets"("blocked_until");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_keys_key_key" ON "idempotency_keys"("key");

-- CreateIndex
CREATE INDEX "idempotency_keys_user_id_expires_at_idx" ON "idempotency_keys"("user_id", "expires_at");

-- CreateIndex
CREATE INDEX "idempotency_keys_order_id_idx" ON "idempotency_keys"("order_id");

-- CreateIndex
CREATE INDEX "idempotency_keys_status_expires_at_idx" ON "idempotency_keys"("status", "expires_at");

-- CreateIndex
CREATE INDEX "idempotency_keys_locked_until_idx" ON "idempotency_keys"("locked_until");

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artist_bio_jobs" ADD CONSTRAINT "artist_bio_jobs_artist_id_fkey" FOREIGN KEY ("artist_id") REFERENCES "artists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artist_bio_jobs" ADD CONSTRAINT "artist_bio_jobs_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artist_bios" ADD CONSTRAINT "artist_bios_artist_id_fkey" FOREIGN KEY ("artist_id") REFERENCES "artists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artist_bios" ADD CONSTRAINT "artist_bios_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "artist_bio_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "concert_artists" ADD CONSTRAINT "concert_artists_concert_id_fkey" FOREIGN KEY ("concert_id") REFERENCES "concerts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "concert_artists" ADD CONSTRAINT "concert_artists_artist_id_fkey" FOREIGN KEY ("artist_id") REFERENCES "artists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "concerts" ADD CONSTRAINT "concerts_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "concerts" ADD CONSTRAINT "concerts_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venue_zones" ADD CONSTRAINT "venue_zones_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seat_maps" ADD CONSTRAINT "seat_maps_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seat_maps" ADD CONSTRAINT "seat_maps_concert_id_fkey" FOREIGN KEY ("concert_id") REFERENCES "concerts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gates" ADD CONSTRAINT "gates_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gate_zones" ADD CONSTRAINT "gate_zones_gate_id_fkey" FOREIGN KEY ("gate_id") REFERENCES "gates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gate_zones" ADD CONSTRAINT "gate_zones_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "venue_zones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkin_devices" ADD CONSTRAINT "checkin_devices_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkin_devices" ADD CONSTRAINT "checkin_devices_concert_id_fkey" FOREIGN KEY ("concert_id") REFERENCES "concerts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkin_devices" ADD CONSTRAINT "checkin_devices_gate_id_fkey" FOREIGN KEY ("gate_id") REFERENCES "gates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkin_sessions" ADD CONSTRAINT "checkin_sessions_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "checkin_devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkin_sessions" ADD CONSTRAINT "checkin_sessions_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkin_sessions" ADD CONSTRAINT "checkin_sessions_concert_id_fkey" FOREIGN KEY ("concert_id") REFERENCES "concerts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkin_sessions" ADD CONSTRAINT "checkin_sessions_gate_id_fkey" FOREIGN KEY ("gate_id") REFERENCES "gates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_types" ADD CONSTRAINT "ticket_types_concert_id_fkey" FOREIGN KEY ("concert_id") REFERENCES "concerts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_types" ADD CONSTRAINT "ticket_types_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "venue_zones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_inventories" ADD CONSTRAINT "ticket_inventories_ticket_type_id_fkey" FOREIGN KEY ("ticket_type_id") REFERENCES "ticket_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_ticket_type_id_fkey" FOREIGN KEY ("ticket_type_id") REFERENCES "ticket_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_ticket_type_counters" ADD CONSTRAINT "user_ticket_type_counters_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_ticket_type_counters" ADD CONSTRAINT "user_ticket_type_counters_ticket_type_id_fkey" FOREIGN KEY ("ticket_type_id") REFERENCES "ticket_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_inventory_events" ADD CONSTRAINT "ticket_inventory_events_ticket_type_id_fkey" FOREIGN KEY ("ticket_type_id") REFERENCES "ticket_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_inventory_events" ADD CONSTRAINT "ticket_inventory_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_inventory_events" ADD CONSTRAINT "ticket_inventory_events_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "inventory_reservations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_concert_id_fkey" FOREIGN KEY ("concert_id") REFERENCES "concerts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_ticket_type_id_fkey" FOREIGN KEY ("ticket_type_id") REFERENCES "ticket_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_concert_id_fkey" FOREIGN KEY ("concert_id") REFERENCES "concerts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_ticket_type_id_fkey" FOREIGN KEY ("ticket_type_id") REFERENCES "ticket_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "venue_zones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_checked_in_by_id_fkey" FOREIGN KEY ("checked_in_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_concert_id_fkey" FOREIGN KEY ("concert_id") REFERENCES "concerts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_import_jobs" ADD CONSTRAINT "guest_import_jobs_concert_id_fkey" FOREIGN KEY ("concert_id") REFERENCES "concerts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_import_jobs" ADD CONSTRAINT "guest_import_jobs_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_list" ADD CONSTRAINT "guest_list_concert_id_fkey" FOREIGN KEY ("concert_id") REFERENCES "concerts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_list" ADD CONSTRAINT "guest_list_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "venue_zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_list" ADD CONSTRAINT "guest_list_checked_in_by_id_fkey" FOREIGN KEY ("checked_in_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_import_errors" ADD CONSTRAINT "guest_import_errors_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "guest_import_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkin_logs" ADD CONSTRAINT "checkin_logs_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkin_logs" ADD CONSTRAINT "checkin_logs_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "guest_list"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkin_logs" ADD CONSTRAINT "checkin_logs_concert_id_fkey" FOREIGN KEY ("concert_id") REFERENCES "concerts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkin_logs" ADD CONSTRAINT "checkin_logs_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "venue_zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkin_logs" ADD CONSTRAINT "checkin_logs_gate_id_fkey" FOREIGN KEY ("gate_id") REFERENCES "gates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkin_logs" ADD CONSTRAINT "checkin_logs_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "checkin_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkin_logs" ADD CONSTRAINT "checkin_logs_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offline_checkin_batches" ADD CONSTRAINT "offline_checkin_batches_concert_id_fkey" FOREIGN KEY ("concert_id") REFERENCES "concerts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offline_checkin_batches" ADD CONSTRAINT "offline_checkin_batches_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offline_checkin_batches" ADD CONSTRAINT "offline_checkin_batches_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "checkin_devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offline_checkin_batches" ADD CONSTRAINT "offline_checkin_batches_gate_id_fkey" FOREIGN KEY ("gate_id") REFERENCES "gates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offline_checkin_items" ADD CONSTRAINT "offline_checkin_items_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "offline_checkin_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offline_checkin_items" ADD CONSTRAINT "offline_checkin_items_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offline_checkin_items" ADD CONSTRAINT "offline_checkin_items_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "guest_list"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offline_checkin_items" ADD CONSTRAINT "offline_checkin_items_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "venue_zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offline_checkin_items" ADD CONSTRAINT "offline_checkin_items_gate_id_fkey" FOREIGN KEY ("gate_id") REFERENCES "gates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

