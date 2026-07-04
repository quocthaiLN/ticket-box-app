-- schema.sql
-- PostgreSQL schema for TicketBox MVP database.
-- Generated from the Prisma schema shape, then tightened with MVP business constraints.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('AUDIENCE', 'ORGANIZER', 'CHECKER', 'ADMIN');

-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('ACTIVE', 'LOCKED', 'DISABLED');

-- CreateEnum
CREATE TYPE "concert_status" AS ENUM ('DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ticket_type_status" AS ENUM ('DRAFT', 'ON_SALE', 'SOLD_OUT', 'CLOSED');

-- CreateEnum
CREATE TYPE "order_status" AS ENUM ('HELD', 'CONFIRMED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "payment_provider" AS ENUM ('VNPAY', 'MOMO');

-- CreateEnum
CREATE TYPE "payment_status" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "ticket_status" AS ENUM ('ISSUED', 'CHECKED_IN', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "device_status" AS ENUM ('ACTIVE', 'REVOKED', 'LOST');

-- CreateEnum
CREATE TYPE "checkin_result" AS ENUM ('SUCCESS', 'ALREADY_CHECKED_IN', 'INVALID_TICKET', 'INVALID_GUEST', 'WRONG_CONCERT', 'WRONG_GATE', 'CONFLICT', 'ERROR');

-- CreateEnum
CREATE TYPE "offline_batch_status" AS ENUM ('PENDING', 'SYNCING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "offline_item_status" AS ENUM ('PENDING', 'ACCEPTED', 'CONFLICT', 'INVALID', 'WRONG_GATE', 'ERROR');

-- CreateEnum
CREATE TYPE "import_status" AS ENUM ('PENDING', 'PROCESSING', 'DONE', 'FAILED', 'PARTIAL');

-- CreateEnum
CREATE TYPE "guest_status" AS ENUM ('INVITED', 'CHECKED_IN', 'CANCELLED');

-- CreateEnum
CREATE TYPE "artist_bio_job_status" AS ENUM ('PENDING', 'PROCESSING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "notification_channel" AS ENUM ('APP', 'EMAIL', 'SMS', 'ZALO');

-- CreateEnum
CREATE TYPE "notification_type" AS ENUM ('SYSTEM', 'ORDER_CONFIRMED', 'PAYMENT_FAILED', 'TICKET_ISSUED', 'CONCERT_UPDATED', 'CHECKIN_ALERT', 'ARTIST_BIO_READY');

-- CreateEnum
CREATE TYPE "notification_status" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" VARCHAR(255) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(20),
    "role" "user_role" NOT NULL DEFAULT 'AUDIENCE',
    "status" "user_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venues" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "address" TEXT NOT NULL,
    "city" VARCHAR(100) NOT NULL,
    "capacity" INTEGER,
    "map_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "venues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concerts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "venue_id" UUID NOT NULL,
    "organizer_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "artist_name" VARCHAR(255) NOT NULL,
    "artist_bio" TEXT,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "status" "concert_status" NOT NULL DEFAULT 'DRAFT',
    "cover_image_url" TEXT,
    "seat_map_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "concerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seat_zones" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "concert_id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "capacity" INTEGER NOT NULL,
    "svg_path" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seat_zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checkin_gates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "concert_id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checkin_gates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checkin_gate_zones" (
    "gate_id" UUID NOT NULL,
    "seat_zone_id" UUID NOT NULL,
    "concert_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checkin_gate_zones_pkey" PRIMARY KEY ("gate_id","seat_zone_id")
);

-- CreateTable
CREATE TABLE "ticket_types" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "concert_id" UUID NOT NULL,
    "seat_zone_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "price" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'VND',
    "total_quantity" INTEGER NOT NULL,
    "held_quantity" INTEGER NOT NULL DEFAULT 0,
    "sold_quantity" INTEGER NOT NULL DEFAULT 0,
    "max_per_user" INTEGER NOT NULL,
    "sale_start_at" TIMESTAMP(3) NOT NULL,
    "sale_end_at" TIMESTAMP(3) NOT NULL,
    "status" "ticket_type_status" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_ticket_type_counters" (
    "user_id" UUID NOT NULL,
    "ticket_type_id" UUID NOT NULL,
    "held_quantity" INTEGER NOT NULL DEFAULT 0,
    "paid_quantity" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_ticket_type_counters_pkey" PRIMARY KEY ("user_id","ticket_type_id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "concert_id" UUID NOT NULL,
    "idempotency_key" VARCHAR(128) NOT NULL,
    "status" "order_status" NOT NULL DEFAULT 'HELD',
    "total_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" CHAR(3) NOT NULL DEFAULT 'VND',
    "hold_expires_at" TIMESTAMP(3),
    "confirmed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "expired_at" TIMESTAMP(3),
    "cancelled_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
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
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "provider" "payment_provider" NOT NULL,
    "provider_transaction_id" VARCHAR(255),
    "idempotency_key" VARCHAR(128) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'VND',
    "status" "payment_status" NOT NULL DEFAULT 'PENDING',
    "checkout_url" TEXT,
    "provider_payload" JSONB,
    "webhook_payload" JSONB,
    "webhook_received_at" TIMESTAMP(3),
    "webhook_signature_valid" BOOLEAN,
    "paid_at" TIMESTAMP(3),
    "failure_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "order_item_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "concert_id" UUID NOT NULL,
    "ticket_type_id" UUID NOT NULL,
    "seat_zone_id" UUID NOT NULL,
    "qr_token_hash" VARCHAR(255) NOT NULL,
    "qr_payload" JSONB,
    "qr_signature" TEXT,
    "status" "ticket_status" NOT NULL DEFAULT 'ISSUED',
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checked_in_at" TIMESTAMP(3),
    "checked_in_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checkin_devices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "device_code" VARCHAR(100) NOT NULL,
    "staff_id" UUID NOT NULL,
    "concert_id" UUID NOT NULL,
    "gate_id" UUID NOT NULL,
    "name" VARCHAR(255),
    "status" "device_status" NOT NULL DEFAULT 'ACTIVE',
    "last_seen_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checkin_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checkin_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ticket_id" UUID,
    "guest_id" UUID,
    "concert_id" UUID NOT NULL,
    "seat_zone_id" UUID,
    "gate_id" UUID,
    "device_id" UUID,
    "staff_id" UUID,
    "scan_token_hash" VARCHAR(255),
    "result" "checkin_result" NOT NULL,
    "reason" TEXT,
    "scanned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checkin_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offline_checkin_batches" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "batch_token" VARCHAR(128) NOT NULL,
    "device_id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "concert_id" UUID NOT NULL,
    "gate_id" UUID NOT NULL,
    "status" "offline_batch_status" NOT NULL DEFAULT 'PENDING',
    "item_count" INTEGER NOT NULL DEFAULT 0,
    "accepted_count" INTEGER NOT NULL DEFAULT 0,
    "conflict_count" INTEGER NOT NULL DEFAULT 0,
    "synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "offline_checkin_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offline_checkin_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "batch_id" UUID NOT NULL,
    "ticket_id" UUID,
    "guest_id" UUID,
    "qr_token_hash" VARCHAR(255),
    "gate_id" UUID,
    "seat_zone_id" UUID,
    "result" "offline_item_status" NOT NULL DEFAULT 'PENDING',
    "error_code" VARCHAR(100),
    "error_message" TEXT,
    "scanned_at" TIMESTAMP(3) NOT NULL,
    "synced_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "offline_checkin_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guest_import_jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "concert_id" UUID NOT NULL,
    "uploaded_by" UUID NOT NULL,
    "file_url" TEXT NOT NULL,
    "status" "import_status" NOT NULL DEFAULT 'PENDING',
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
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "concert_id" UUID NOT NULL,
    "seat_zone_id" UUID,
    "import_job_id" UUID,
    "full_name" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "email" VARCHAR(255),
    "code" VARCHAR(100),
    "status" "guest_status" NOT NULL DEFAULT 'INVITED',
    "checked_in_at" TIMESTAMP(3),
    "checked_in_by" UUID,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guest_list_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guest_import_errors" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "job_id" UUID NOT NULL,
    "row_number" INTEGER NOT NULL,
    "raw_data" JSONB,
    "error_code" VARCHAR(100) NOT NULL,
    "error_message" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guest_import_errors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "artist_bio_jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "concert_id" UUID NOT NULL,
    "requested_by" UUID,
    "status" "artist_bio_job_status" NOT NULL DEFAULT 'PENDING',
    "source_file_url" TEXT NOT NULL,
    "extracted_text" TEXT,
    "generated_bio" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "artist_bio_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "concert_id" UUID,
    "ticket_id" UUID,
    "channel" "notification_channel" NOT NULL,
    "type" "notification_type" NOT NULL,
    "status" "notification_status" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actor_user_id" UUID,
    "action" VARCHAR(100) NOT NULL,
    "entity_type" VARCHAR(100) NOT NULL,
    "entity_id" VARCHAR(100),
    "metadata" JSONB,
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE INDEX "venues_city_idx" ON "venues"("city");

-- CreateIndex
CREATE UNIQUE INDEX "concerts_slug_key" ON "concerts"("slug");

-- CreateIndex
CREATE INDEX "concerts_status_starts_at_idx" ON "concerts"("status", "starts_at");

-- CreateIndex
CREATE INDEX "concerts_venue_id_idx" ON "concerts"("venue_id");

-- CreateIndex
CREATE INDEX "concerts_organizer_id_status_idx" ON "concerts"("organizer_id", "status");

-- CreateIndex
CREATE INDEX "seat_zones_concert_id_sort_order_idx" ON "seat_zones"("concert_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "seat_zones_concert_id_code_key" ON "seat_zones"("concert_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "seat_zones_id_concert_id_key" ON "seat_zones"("id", "concert_id");

-- CreateIndex
CREATE INDEX "checkin_gates_concert_id_is_active_idx" ON "checkin_gates"("concert_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "checkin_gates_concert_id_code_key" ON "checkin_gates"("concert_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "checkin_gates_id_concert_id_key" ON "checkin_gates"("id", "concert_id");

-- CreateIndex
CREATE INDEX "checkin_gate_zones_seat_zone_id_idx" ON "checkin_gate_zones"("seat_zone_id");

-- CreateIndex
CREATE INDEX "checkin_gate_zones_concert_id_idx" ON "checkin_gate_zones"("concert_id");

-- CreateIndex
CREATE INDEX "ticket_types_concert_id_status_idx" ON "ticket_types"("concert_id", "status");

-- CreateIndex
CREATE INDEX "ticket_types_seat_zone_id_idx" ON "ticket_types"("seat_zone_id");

-- CreateIndex
CREATE INDEX "ticket_types_sale_start_at_sale_end_at_idx" ON "ticket_types"("sale_start_at", "sale_end_at");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_types_concert_id_name_key" ON "ticket_types"("concert_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_types_id_concert_id_key" ON "ticket_types"("id", "concert_id");

-- CreateIndex
CREATE INDEX "user_ticket_type_counters_ticket_type_id_idx" ON "user_ticket_type_counters"("ticket_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_idempotency_key_key" ON "orders"("idempotency_key");

-- CreateIndex
CREATE INDEX "orders_user_id_status_created_at_idx" ON "orders"("user_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "orders_concert_id_status_idx" ON "orders"("concert_id", "status");

-- CreateIndex
CREATE INDEX "orders_hold_expires_at_idx" ON "orders"("hold_expires_at");

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");

-- CreateIndex
CREATE INDEX "order_items_ticket_type_id_idx" ON "order_items"("ticket_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_idempotency_key_key" ON "payments"("idempotency_key");

-- CreateIndex
CREATE INDEX "payments_order_id_status_idx" ON "payments"("order_id", "status");

-- CreateIndex
CREATE INDEX "payments_status_created_at_idx" ON "payments"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "payments_provider_provider_transaction_id_key" ON "payments"("provider", "provider_transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_qr_token_hash_key" ON "tickets"("qr_token_hash");

-- CreateIndex
CREATE INDEX "tickets_order_id_idx" ON "tickets"("order_id");

-- CreateIndex
CREATE INDEX "tickets_order_item_id_idx" ON "tickets"("order_item_id");

-- CreateIndex
CREATE INDEX "tickets_user_id_concert_id_status_idx" ON "tickets"("user_id", "concert_id", "status");

-- CreateIndex
CREATE INDEX "tickets_user_id_ticket_type_id_status_idx" ON "tickets"("user_id", "ticket_type_id", "status");

-- CreateIndex
CREATE INDEX "tickets_ticket_type_id_status_idx" ON "tickets"("ticket_type_id", "status");

-- CreateIndex
CREATE INDEX "tickets_seat_zone_id_idx" ON "tickets"("seat_zone_id");

-- CreateIndex
CREATE INDEX "tickets_checked_in_at_idx" ON "tickets"("checked_in_at");

-- CreateIndex
CREATE UNIQUE INDEX "checkin_devices_device_code_key" ON "checkin_devices"("device_code");

-- CreateIndex
CREATE INDEX "checkin_devices_staff_id_status_idx" ON "checkin_devices"("staff_id", "status");

-- CreateIndex
CREATE INDEX "checkin_devices_concert_id_gate_id_status_idx" ON "checkin_devices"("concert_id", "gate_id", "status");

-- CreateIndex
CREATE INDEX "checkin_logs_ticket_id_scanned_at_idx" ON "checkin_logs"("ticket_id", "scanned_at");

-- CreateIndex
CREATE INDEX "checkin_logs_concert_id_scanned_at_idx" ON "checkin_logs"("concert_id", "scanned_at");

-- CreateIndex
CREATE INDEX "checkin_logs_gate_id_scanned_at_idx" ON "checkin_logs"("gate_id", "scanned_at");

-- CreateIndex
CREATE INDEX "checkin_logs_device_id_scanned_at_idx" ON "checkin_logs"("device_id", "scanned_at");

-- CreateIndex
CREATE INDEX "checkin_logs_guest_id_scanned_at_idx" ON "checkin_logs"("guest_id", "scanned_at");

-- CreateIndex
CREATE UNIQUE INDEX "offline_checkin_batches_batch_token_key" ON "offline_checkin_batches"("batch_token");

-- CreateIndex
CREATE INDEX "offline_checkin_batches_concert_id_status_idx" ON "offline_checkin_batches"("concert_id", "status");

-- CreateIndex
CREATE INDEX "offline_checkin_batches_device_id_status_idx" ON "offline_checkin_batches"("device_id", "status");

-- CreateIndex
CREATE INDEX "offline_checkin_batches_gate_id_status_idx" ON "offline_checkin_batches"("gate_id", "status");

-- CreateIndex
CREATE INDEX "offline_checkin_items_batch_id_result_idx" ON "offline_checkin_items"("batch_id", "result");

-- CreateIndex
CREATE INDEX "offline_checkin_items_ticket_id_idx" ON "offline_checkin_items"("ticket_id");

-- CreateIndex
CREATE INDEX "offline_checkin_items_guest_id_idx" ON "offline_checkin_items"("guest_id");

-- CreateIndex
CREATE INDEX "offline_checkin_items_gate_id_result_idx" ON "offline_checkin_items"("gate_id", "result");

-- CreateIndex
CREATE UNIQUE INDEX "offline_checkin_items_batch_id_qr_token_hash_key" ON "offline_checkin_items"("batch_id", "qr_token_hash");

-- CreateIndex
CREATE INDEX "guest_import_jobs_concert_id_status_idx" ON "guest_import_jobs"("concert_id", "status");

-- CreateIndex
CREATE INDEX "guest_list_concert_id_status_idx" ON "guest_list"("concert_id", "status");

-- CreateIndex
CREATE INDEX "guest_list_phone_idx" ON "guest_list"("phone");

-- CreateIndex
CREATE INDEX "guest_list_seat_zone_id_idx" ON "guest_list"("seat_zone_id");

-- CreateIndex
CREATE UNIQUE INDEX "guest_list_concert_id_phone_key" ON "guest_list"("concert_id", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "guest_list_concert_id_code_key" ON "guest_list"("concert_id", "code");

-- CreateIndex
CREATE INDEX "guest_import_errors_job_id_idx" ON "guest_import_errors"("job_id");

-- CreateIndex
CREATE UNIQUE INDEX "guest_import_errors_job_id_row_number_error_code_key" ON "guest_import_errors"("job_id", "row_number", "error_code");

-- CreateIndex
CREATE INDEX "artist_bio_jobs_concert_id_status_idx" ON "artist_bio_jobs"("concert_id", "status");

-- CreateIndex
CREATE INDEX "artist_bio_jobs_status_created_at_idx" ON "artist_bio_jobs"("status", "created_at");

-- CreateIndex
CREATE INDEX "notifications_status_created_at_idx" ON "notifications"("status", "created_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "notifications_concert_id_status_idx" ON "notifications"("concert_id", "status");

-- CreateIndex
CREATE INDEX "notifications_ticket_id_idx" ON "notifications"("ticket_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_created_at_idx" ON "audit_logs"("entity_type", "entity_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_actor_user_id_created_at_idx" ON "audit_logs"("actor_user_id", "created_at");

-- AddForeignKey
ALTER TABLE "concerts" ADD CONSTRAINT "concerts_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "concerts" ADD CONSTRAINT "concerts_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seat_zones" ADD CONSTRAINT "seat_zones_concert_id_fkey" FOREIGN KEY ("concert_id") REFERENCES "concerts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkin_gates" ADD CONSTRAINT "checkin_gates_concert_id_fkey" FOREIGN KEY ("concert_id") REFERENCES "concerts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkin_gate_zones" ADD CONSTRAINT "checkin_gate_zones_gate_id_concert_id_fkey" FOREIGN KEY ("gate_id", "concert_id") REFERENCES "checkin_gates"("id", "concert_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkin_gate_zones" ADD CONSTRAINT "checkin_gate_zones_seat_zone_id_concert_id_fkey" FOREIGN KEY ("seat_zone_id", "concert_id") REFERENCES "seat_zones"("id", "concert_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_types" ADD CONSTRAINT "ticket_types_concert_id_fkey" FOREIGN KEY ("concert_id") REFERENCES "concerts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_types" ADD CONSTRAINT "ticket_types_seat_zone_id_concert_id_fkey" FOREIGN KEY ("seat_zone_id", "concert_id") REFERENCES "seat_zones"("id", "concert_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_ticket_type_counters" ADD CONSTRAINT "user_ticket_type_counters_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_ticket_type_counters" ADD CONSTRAINT "user_ticket_type_counters_ticket_type_id_fkey" FOREIGN KEY ("ticket_type_id") REFERENCES "ticket_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_ticket_type_id_concert_id_fkey" FOREIGN KEY ("ticket_type_id", "concert_id") REFERENCES "ticket_types"("id", "concert_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_seat_zone_id_concert_id_fkey" FOREIGN KEY ("seat_zone_id", "concert_id") REFERENCES "seat_zones"("id", "concert_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_checked_in_by_fkey" FOREIGN KEY ("checked_in_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkin_devices" ADD CONSTRAINT "checkin_devices_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkin_devices" ADD CONSTRAINT "checkin_devices_concert_id_fkey" FOREIGN KEY ("concert_id") REFERENCES "concerts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkin_devices" ADD CONSTRAINT "checkin_devices_gate_id_concert_id_fkey" FOREIGN KEY ("gate_id", "concert_id") REFERENCES "checkin_gates"("id", "concert_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkin_logs" ADD CONSTRAINT "checkin_logs_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkin_logs" ADD CONSTRAINT "checkin_logs_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "guest_list"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkin_logs" ADD CONSTRAINT "checkin_logs_concert_id_fkey" FOREIGN KEY ("concert_id") REFERENCES "concerts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkin_logs" ADD CONSTRAINT "checkin_logs_seat_zone_id_concert_id_fkey" FOREIGN KEY ("seat_zone_id", "concert_id") REFERENCES "seat_zones"("id", "concert_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkin_logs" ADD CONSTRAINT "checkin_logs_gate_id_concert_id_fkey" FOREIGN KEY ("gate_id", "concert_id") REFERENCES "checkin_gates"("id", "concert_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkin_logs" ADD CONSTRAINT "checkin_logs_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "checkin_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkin_logs" ADD CONSTRAINT "checkin_logs_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offline_checkin_batches" ADD CONSTRAINT "offline_checkin_batches_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "checkin_devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offline_checkin_batches" ADD CONSTRAINT "offline_checkin_batches_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offline_checkin_batches" ADD CONSTRAINT "offline_checkin_batches_concert_id_fkey" FOREIGN KEY ("concert_id") REFERENCES "concerts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offline_checkin_batches" ADD CONSTRAINT "offline_checkin_batches_gate_id_concert_id_fkey" FOREIGN KEY ("gate_id", "concert_id") REFERENCES "checkin_gates"("id", "concert_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offline_checkin_items" ADD CONSTRAINT "offline_checkin_items_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "offline_checkin_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offline_checkin_items" ADD CONSTRAINT "offline_checkin_items_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offline_checkin_items" ADD CONSTRAINT "offline_checkin_items_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "guest_list"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offline_checkin_items" ADD CONSTRAINT "offline_checkin_items_gate_id_fkey" FOREIGN KEY ("gate_id") REFERENCES "checkin_gates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offline_checkin_items" ADD CONSTRAINT "offline_checkin_items_seat_zone_id_fkey" FOREIGN KEY ("seat_zone_id") REFERENCES "seat_zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_import_jobs" ADD CONSTRAINT "guest_import_jobs_concert_id_fkey" FOREIGN KEY ("concert_id") REFERENCES "concerts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_import_jobs" ADD CONSTRAINT "guest_import_jobs_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_list" ADD CONSTRAINT "guest_list_concert_id_fkey" FOREIGN KEY ("concert_id") REFERENCES "concerts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_list" ADD CONSTRAINT "guest_list_seat_zone_id_concert_id_fkey" FOREIGN KEY ("seat_zone_id", "concert_id") REFERENCES "seat_zones"("id", "concert_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_list" ADD CONSTRAINT "guest_list_import_job_id_fkey" FOREIGN KEY ("import_job_id") REFERENCES "guest_import_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_list" ADD CONSTRAINT "guest_list_checked_in_by_fkey" FOREIGN KEY ("checked_in_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_import_errors" ADD CONSTRAINT "guest_import_errors_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "guest_import_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artist_bio_jobs" ADD CONSTRAINT "artist_bio_jobs_concert_id_fkey" FOREIGN KEY ("concert_id") REFERENCES "concerts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artist_bio_jobs" ADD CONSTRAINT "artist_bio_jobs_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_concert_id_fkey" FOREIGN KEY ("concert_id") REFERENCES "concerts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Business constraints kept close to the base schema.
ALTER TABLE "users"
  ADD CONSTRAINT "ck_users_email_format" CHECK (position('@' in "email") > 1),
  ADD CONSTRAINT "ck_users_phone_format" CHECK ("phone" IS NULL OR "phone" ~ '^[0-9+]{8,20}$');

ALTER TABLE "venues"
  ADD CONSTRAINT "ck_venues_capacity_positive" CHECK ("capacity" IS NULL OR "capacity" > 0);

ALTER TABLE "concerts"
  ADD CONSTRAINT "ck_concerts_time_range" CHECK ("ends_at" > "starts_at");

ALTER TABLE "seat_zones"
  ADD CONSTRAINT "ck_seat_zones_capacity_positive" CHECK ("capacity" > 0);

ALTER TABLE "ticket_types"
  ADD CONSTRAINT "ck_ticket_types_price_non_negative" CHECK ("price" >= 0),
  ADD CONSTRAINT "ck_ticket_types_quantities_non_negative" CHECK (
    "total_quantity" >= 0
    AND "held_quantity" >= 0
    AND "sold_quantity" >= 0
  ),
  ADD CONSTRAINT "ck_ticket_types_quantity_sum" CHECK ("total_quantity" >= "held_quantity" + "sold_quantity"),
  ADD CONSTRAINT "ck_ticket_types_max_per_user_positive" CHECK ("max_per_user" > 0),
  ADD CONSTRAINT "ck_ticket_types_sale_time_range" CHECK ("sale_end_at" > "sale_start_at");

ALTER TABLE "user_ticket_type_counters"
  ADD CONSTRAINT "ck_user_ticket_counters_counts_non_negative" CHECK (
    "held_quantity" >= 0
    AND "paid_quantity" >= 0
  );

ALTER TABLE "orders"
  ADD CONSTRAINT "ck_orders_total_amount_non_negative" CHECK ("total_amount" >= 0),
  ADD CONSTRAINT "ck_orders_hold_expiry_required" CHECK ("status" <> 'HELD' OR "hold_expires_at" IS NOT NULL),
  ADD CONSTRAINT "ck_orders_confirmed_at_required" CHECK ("status" <> 'CONFIRMED' OR "confirmed_at" IS NOT NULL),
  ADD CONSTRAINT "ck_orders_cancelled_at_required" CHECK ("status" <> 'CANCELLED' OR "cancelled_at" IS NOT NULL),
  ADD CONSTRAINT "ck_orders_expired_at_required" CHECK ("status" <> 'EXPIRED' OR "expired_at" IS NOT NULL);

ALTER TABLE "order_items"
  ADD CONSTRAINT "ck_order_items_quantity_positive" CHECK ("quantity" > 0),
  ADD CONSTRAINT "ck_order_items_unit_price_non_negative" CHECK ("unit_price" >= 0),
  ADD CONSTRAINT "ck_order_items_line_total_non_negative" CHECK ("line_total" >= 0),
  ADD CONSTRAINT "ck_order_items_line_total_matches_quantity" CHECK ("line_total" = "quantity" * "unit_price");

ALTER TABLE "payments"
  ADD CONSTRAINT "ck_payments_amount_positive" CHECK ("amount" > 0),
  ADD CONSTRAINT "ck_payments_paid_at_required" CHECK ("status" <> 'SUCCEEDED' OR "paid_at" IS NOT NULL);

ALTER TABLE "tickets"
  ADD CONSTRAINT "ck_tickets_checked_in_at_required" CHECK ("status" <> 'CHECKED_IN' OR "checked_in_at" IS NOT NULL);

ALTER TABLE "offline_checkin_batches"
  ADD CONSTRAINT "ck_offline_batches_counts_non_negative" CHECK (
    "item_count" >= 0
    AND "accepted_count" >= 0
    AND "conflict_count" >= 0
  );

ALTER TABLE "offline_checkin_items"
  ADD CONSTRAINT "ck_offline_items_has_target" CHECK (
    "qr_token_hash" IS NOT NULL
    OR "ticket_id" IS NOT NULL
    OR "guest_id" IS NOT NULL
  );

ALTER TABLE "guest_import_jobs"
  ADD CONSTRAINT "ck_guest_import_counts_non_negative" CHECK (
    "total_rows" >= 0
    AND "success_rows" >= 0
    AND "error_rows" >= 0
  );

ALTER TABLE "guest_import_errors"
  ADD CONSTRAINT "ck_guest_import_errors_row_positive" CHECK ("row_number" > 0);

ALTER TABLE "notifications"
  ADD CONSTRAINT "ck_notifications_attempts_non_negative" CHECK ("attempts" >= 0);

-- Keep updated_at fresh for raw SQL writes as well as Prisma writes.
CREATE TRIGGER "trg_users_set_updated_at" BEFORE UPDATE ON "users" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER "trg_venues_set_updated_at" BEFORE UPDATE ON "venues" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER "trg_concerts_set_updated_at" BEFORE UPDATE ON "concerts" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER "trg_seat_zones_set_updated_at" BEFORE UPDATE ON "seat_zones" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER "trg_checkin_gates_set_updated_at" BEFORE UPDATE ON "checkin_gates" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER "trg_ticket_types_set_updated_at" BEFORE UPDATE ON "ticket_types" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER "trg_user_ticket_type_counters_set_updated_at" BEFORE UPDATE ON "user_ticket_type_counters" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER "trg_orders_set_updated_at" BEFORE UPDATE ON "orders" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER "trg_payments_set_updated_at" BEFORE UPDATE ON "payments" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER "trg_tickets_set_updated_at" BEFORE UPDATE ON "tickets" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER "trg_checkin_devices_set_updated_at" BEFORE UPDATE ON "checkin_devices" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER "trg_offline_checkin_batches_set_updated_at" BEFORE UPDATE ON "offline_checkin_batches" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER "trg_guest_import_jobs_set_updated_at" BEFORE UPDATE ON "guest_import_jobs" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER "trg_guest_list_set_updated_at" BEFORE UPDATE ON "guest_list" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER "trg_artist_bio_jobs_set_updated_at" BEFORE UPDATE ON "artist_bio_jobs" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER "trg_notifications_set_updated_at" BEFORE UPDATE ON "notifications" FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;

-- schema-supplement.sql
-- PostgreSQL-only safeguards that Prisma cannot express cleanly.

BEGIN;

-- Fast worker scans. These are partial indexes over hot queues.
CREATE INDEX IF NOT EXISTS idx_orders_expirable_held
  ON orders(hold_expires_at)
  WHERE status = 'HELD';

CREATE INDEX IF NOT EXISTS idx_notifications_pending_worker
  ON notifications(created_at)
  WHERE status = 'PENDING';

CREATE INDEX IF NOT EXISTS idx_ticket_types_available_public
  ON ticket_types(concert_id, status, sale_start_at, sale_end_at)
  WHERE total_quantity > held_quantity + sold_quantity;

-- Order items must use ticket types from the same concert as the order.
CREATE OR REPLACE FUNCTION validate_order_item_concert()
RETURNS trigger AS $$
DECLARE
  source_order_concert_id uuid;
  source_ticket_type_concert_id uuid;
BEGIN
  SELECT concert_id INTO source_order_concert_id
  FROM orders
  WHERE id = NEW.order_id;

  SELECT concert_id INTO source_ticket_type_concert_id
  FROM ticket_types
  WHERE id = NEW.ticket_type_id;

  IF source_order_concert_id IS NULL OR source_ticket_type_concert_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF source_order_concert_id <> source_ticket_type_concert_id THEN
    RAISE EXCEPTION 'Order % and ticket type % must belong to the same concert',
      NEW.order_id, NEW.ticket_type_id
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_order_items_same_concert ON order_items;

CREATE TRIGGER trg_order_items_same_concert
  BEFORE INSERT OR UPDATE OF order_id, ticket_type_id ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION validate_order_item_concert();

-- Tickets keep denormalized lookup fields for QR/check-in speed, but the source is order_item -> ticket_type.
CREATE OR REPLACE FUNCTION sync_ticket_denormalized_fields()
RETURNS trigger AS $$
DECLARE
  source_order_id uuid;
  source_user_id uuid;
  source_order_concert_id uuid;
  source_ticket_type_id uuid;
  source_ticket_type_concert_id uuid;
  source_seat_zone_id uuid;
BEGIN
  SELECT
    oi.order_id,
    o.user_id,
    o.concert_id,
    oi.ticket_type_id,
    tt.concert_id,
    tt.seat_zone_id
  INTO
    source_order_id,
    source_user_id,
    source_order_concert_id,
    source_ticket_type_id,
    source_ticket_type_concert_id,
    source_seat_zone_id
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  JOIN ticket_types tt ON tt.id = oi.ticket_type_id
  WHERE oi.id = NEW.order_item_id;

  IF source_order_id IS NULL THEN
    RAISE EXCEPTION 'Order item % was not found for ticket %', NEW.order_item_id, NEW.id
      USING ERRCODE = '23503';
  END IF;

  IF source_ticket_type_concert_id <> source_order_concert_id THEN
    RAISE EXCEPTION 'Ticket type % belongs to concert %, but order % belongs to concert %',
      source_ticket_type_id, source_ticket_type_concert_id, source_order_id, source_order_concert_id
      USING ERRCODE = '23514';
  END IF;

  NEW.order_id := source_order_id;
  NEW.user_id := source_user_id;
  NEW.concert_id := source_order_concert_id;
  NEW.ticket_type_id := source_ticket_type_id;
  NEW.seat_zone_id := source_seat_zone_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tickets_sync_denormalized_fields ON tickets;

CREATE TRIGGER trg_tickets_sync_denormalized_fields
  BEFORE INSERT OR UPDATE OF order_item_id, order_id, user_id, concert_id, ticket_type_id, seat_zone_id
  ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION sync_ticket_denormalized_fields();

CREATE OR REPLACE FUNCTION prevent_ticket_order_item_source_mutation()
RETURNS trigger AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM tickets WHERE order_item_id = OLD.id LIMIT 1) THEN
    RAISE EXCEPTION 'Order item % cannot change order_id or ticket_type_id after tickets are issued', OLD.id
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_order_items_prevent_ticket_source_mutation ON order_items;

CREATE TRIGGER trg_order_items_prevent_ticket_source_mutation
  BEFORE UPDATE OF order_id, ticket_type_id ON order_items
  FOR EACH ROW
  WHEN (OLD.order_id IS DISTINCT FROM NEW.order_id OR OLD.ticket_type_id IS DISTINCT FROM NEW.ticket_type_id)
  EXECUTE FUNCTION prevent_ticket_order_item_source_mutation();

CREATE OR REPLACE FUNCTION prevent_ticket_order_source_mutation()
RETURNS trigger AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM tickets WHERE order_id = OLD.id LIMIT 1) THEN
    RAISE EXCEPTION 'Order % cannot change user_id or concert_id after tickets are issued', OLD.id
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_orders_prevent_ticket_source_mutation ON orders;

CREATE TRIGGER trg_orders_prevent_ticket_source_mutation
  BEFORE UPDATE OF user_id, concert_id ON orders
  FOR EACH ROW
  WHEN (OLD.user_id IS DISTINCT FROM NEW.user_id OR OLD.concert_id IS DISTINCT FROM NEW.concert_id)
  EXECUTE FUNCTION prevent_ticket_order_source_mutation();

CREATE OR REPLACE FUNCTION prevent_ticket_type_source_mutation()
RETURNS trigger AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM tickets WHERE ticket_type_id = OLD.id LIMIT 1) THEN
    RAISE EXCEPTION 'Ticket type % cannot change concert_id or seat_zone_id after tickets are issued', OLD.id
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ticket_types_prevent_ticket_source_mutation ON ticket_types;

CREATE TRIGGER trg_ticket_types_prevent_ticket_source_mutation
  BEFORE UPDATE OF concert_id, seat_zone_id ON ticket_types
  FOR EACH ROW
  WHEN (OLD.concert_id IS DISTINCT FROM NEW.concert_id OR OLD.seat_zone_id IS DISTINCT FROM NEW.seat_zone_id)
  EXECUTE FUNCTION prevent_ticket_type_source_mutation();

COMMIT;
