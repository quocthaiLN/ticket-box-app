-- schema-supplement.sql
-- Patch bổ sung cho schema TicketBox hiện tại.
-- Mục tiêu:
-- 1) Per-user ticket limit dưới tải cao.
-- 2) Payment webhook/IPN idempotency.
-- 3) Offline check-in device management.
-- 4) Notification DLQ.
-- 5) Audit biến động tồn kho vé.
-- 6) Gate-zone validation: vé/guest thuộc khu nào chỉ được check-in ở cổng được phép cho khu đó.

BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'device_status') THEN
        CREATE TYPE device_status AS ENUM ('ACTIVE', 'REVOKED', 'LOST');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inventory_event_type') THEN
        CREATE TYPE inventory_event_type AS ENUM ('HOLD', 'RELEASE', 'PAYMENT_CONFIRMED', 'REFUND', 'ADMIN_ADJUST');
    END IF;
END $$;

ALTER TYPE checkin_result ADD VALUE IF NOT EXISTS 'WRONG_GATE';
ALTER TYPE offline_item_status ADD VALUE IF NOT EXISTS 'WRONG_GATE';

CREATE TABLE IF NOT EXISTS checkin_gates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    concert_id UUID NOT NULL,
    gate_code VARCHAR(50) NOT NULL,
    gate_name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_checkin_gates_concert FOREIGN KEY (concert_id) REFERENCES concerts(id) ON DELETE CASCADE,
    CONSTRAINT uq_checkin_gates_concert_code UNIQUE (concert_id, gate_code),
    CONSTRAINT ck_checkin_gates_code_not_empty CHECK (length(trim(gate_code)) > 0)
);

CREATE TABLE IF NOT EXISTS checkin_gate_zones (
    gate_id UUID NOT NULL,
    seat_zone_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (gate_id, seat_zone_id),
    CONSTRAINT fk_checkin_gate_zones_gate FOREIGN KEY (gate_id) REFERENCES checkin_gates(id) ON DELETE CASCADE,
    CONSTRAINT fk_checkin_gate_zones_zone FOREIGN KEY (seat_zone_id) REFERENCES seat_zones(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_ticket_type_counters (
    user_id UUID NOT NULL,
    ticket_type_id UUID NOT NULL,
    held_quantity INTEGER NOT NULL DEFAULT 0,
    paid_quantity INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, ticket_type_id),
    CONSTRAINT fk_user_ticket_counters_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_ticket_counters_ticket_type FOREIGN KEY (ticket_type_id) REFERENCES ticket_types(id) ON DELETE CASCADE,
    CONSTRAINT ck_user_ticket_counters_held_non_negative CHECK (held_quantity >= 0),
    CONSTRAINT ck_user_ticket_counters_paid_non_negative CHECK (paid_quantity >= 0)
);

CREATE TABLE IF NOT EXISTS ticket_inventory_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_type_id UUID NOT NULL,
    order_id UUID,
    event_type inventory_event_type NOT NULL,
    quantity INTEGER NOT NULL,
    before_available INTEGER,
    after_available INTEGER,
    before_held INTEGER,
    after_held INTEGER,
    before_sold INTEGER,
    after_sold INTEGER,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_inventory_events_ticket_type FOREIGN KEY (ticket_type_id) REFERENCES ticket_types(id) ON DELETE CASCADE,
    CONSTRAINT fk_inventory_events_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
    CONSTRAINT ck_inventory_events_quantity_positive CHECK (quantity > 0),
    CONSTRAINT ck_inventory_events_before_after_non_negative CHECK (
        (before_available IS NULL OR before_available >= 0) AND
        (after_available IS NULL OR after_available >= 0) AND
        (before_held IS NULL OR before_held >= 0) AND
        (after_held IS NULL OR after_held >= 0) AND
        (before_sold IS NULL OR before_sold >= 0) AND
        (after_sold IS NULL OR after_sold >= 0)
    )
);

CREATE TABLE IF NOT EXISTS payment_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider payment_provider NOT NULL,
    provider_event_id VARCHAR(255),
    provider_transaction_id VARCHAR(255),
    order_id UUID,
    payment_id UUID,
    raw_payload JSONB NOT NULL,
    signature_valid BOOLEAN NOT NULL DEFAULT FALSE,
    processed BOOLEAN NOT NULL DEFAULT FALSE,
    processed_at TIMESTAMPTZ,
    error_message TEXT,
    received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_payment_webhook_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
    CONSTRAINT fk_payment_webhook_payment FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE SET NULL,
    CONSTRAINT ck_payment_webhook_processed_at_required CHECK (processed = FALSE OR processed_at IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS checkin_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_code VARCHAR(100) NOT NULL UNIQUE,
    staff_id UUID,
    concert_id UUID,
    gate_id UUID,
    public_key TEXT,
    status device_status NOT NULL DEFAULT 'ACTIVE',
    last_sync_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_checkin_devices_staff FOREIGN KEY (staff_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_checkin_devices_concert FOREIGN KEY (concert_id) REFERENCES concerts(id) ON DELETE CASCADE,
    CONSTRAINT fk_checkin_devices_gate FOREIGN KEY (gate_id) REFERENCES checkin_gates(id) ON DELETE SET NULL,
    CONSTRAINT ck_checkin_devices_revoked_at_required CHECK (status <> 'REVOKED' OR revoked_at IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS notification_dead_letters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_log_id UUID,
    payload JSONB NOT NULL,
    error_message TEXT NOT NULL,
    failed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ,
    CONSTRAINT fk_notification_dlq_log FOREIGN KEY (notification_log_id) REFERENCES notification_logs(id) ON DELETE SET NULL,
    CONSTRAINT ck_notification_dlq_error_not_empty CHECK (length(trim(error_message)) > 0),
    CONSTRAINT ck_notification_dlq_resolved_after_failed CHECK (resolved_at IS NULL OR resolved_at >= failed_at)
);

-- Non-breaking columns for older schema versions.
ALTER TABLE checkin_devices ADD COLUMN IF NOT EXISTS gate_id UUID;
ALTER TABLE checkin_logs ADD COLUMN IF NOT EXISTS gate_id UUID;
ALTER TABLE checkin_logs ADD COLUMN IF NOT EXISTS seat_zone_id UUID;
ALTER TABLE checkin_logs ADD COLUMN IF NOT EXISTS guest_id UUID;
ALTER TABLE checkin_logs ADD COLUMN IF NOT EXISTS device_uuid UUID;
ALTER TABLE offline_checkin_batches ADD COLUMN IF NOT EXISTS gate_id UUID;
ALTER TABLE offline_checkin_batches ADD COLUMN IF NOT EXISTS device_uuid UUID;
ALTER TABLE offline_checkin_items ADD COLUMN IF NOT EXISTS gate_id UUID;
ALTER TABLE offline_checkin_items ADD COLUMN IF NOT EXISTS seat_zone_id UUID;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_checkin_logs_gate') THEN
        ALTER TABLE checkin_logs ADD CONSTRAINT fk_checkin_logs_gate FOREIGN KEY (gate_id) REFERENCES checkin_gates(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_checkin_logs_seat_zone') THEN
        ALTER TABLE checkin_logs ADD CONSTRAINT fk_checkin_logs_seat_zone FOREIGN KEY (seat_zone_id) REFERENCES seat_zones(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_checkin_logs_guest') THEN
        ALTER TABLE checkin_logs ADD CONSTRAINT fk_checkin_logs_guest FOREIGN KEY (guest_id) REFERENCES guest_list(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_checkin_logs_device_uuid') THEN
        ALTER TABLE checkin_logs ADD CONSTRAINT fk_checkin_logs_device_uuid FOREIGN KEY (device_uuid) REFERENCES checkin_devices(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_offline_batches_gate') THEN
        ALTER TABLE offline_checkin_batches ADD CONSTRAINT fk_offline_batches_gate FOREIGN KEY (gate_id) REFERENCES checkin_gates(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_offline_batches_device_uuid') THEN
        ALTER TABLE offline_checkin_batches ADD CONSTRAINT fk_offline_batches_device_uuid FOREIGN KEY (device_uuid) REFERENCES checkin_devices(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_offline_items_gate') THEN
        ALTER TABLE offline_checkin_items ADD CONSTRAINT fk_offline_items_gate FOREIGN KEY (gate_id) REFERENCES checkin_gates(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_offline_items_seat_zone') THEN
        ALTER TABLE offline_checkin_items ADD CONSTRAINT fk_offline_items_seat_zone FOREIGN KEY (seat_zone_id) REFERENCES seat_zones(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_webhook_provider_event
    ON payment_webhook_events(provider, provider_event_id)
    WHERE provider_event_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_webhook_provider_transaction
    ON payment_webhook_events(provider, provider_transaction_id)
    WHERE provider_transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_checkin_gates_concert_active ON checkin_gates(concert_id, is_active);
CREATE INDEX IF NOT EXISTS idx_checkin_gate_zones_zone_id ON checkin_gate_zones(seat_zone_id);
CREATE INDEX IF NOT EXISTS idx_user_ticket_counters_ticket_type ON user_ticket_type_counters(ticket_type_id);
CREATE INDEX IF NOT EXISTS idx_inventory_events_ticket_type_created_at ON ticket_inventory_events(ticket_type_id, created_at);
CREATE INDEX IF NOT EXISTS idx_inventory_events_order_id ON ticket_inventory_events(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_webhook_order_received ON payment_webhook_events(order_id, received_at);
CREATE INDEX IF NOT EXISTS idx_payment_webhook_processed_received ON payment_webhook_events(processed, received_at);
CREATE INDEX IF NOT EXISTS idx_tickets_user_ticket_type_status ON tickets(user_id, ticket_type_id, status);
CREATE INDEX IF NOT EXISTS idx_checkin_devices_staff_status ON checkin_devices(staff_id, status);
CREATE INDEX IF NOT EXISTS idx_checkin_devices_concert_gate_status ON checkin_devices(concert_id, gate_id, status);
CREATE INDEX IF NOT EXISTS idx_checkin_logs_gate_scanned_at ON checkin_logs(gate_id, scanned_at);
CREATE INDEX IF NOT EXISTS idx_checkin_logs_device_uuid_scanned_at ON checkin_logs(device_uuid, scanned_at);
CREATE INDEX IF NOT EXISTS idx_offline_batches_gate_status ON offline_checkin_batches(gate_id, status);
CREATE INDEX IF NOT EXISTS idx_offline_items_gate_result ON offline_checkin_items(gate_id, sync_result);
CREATE INDEX IF NOT EXISTS idx_notification_dlq_failed_at ON notification_dead_letters(failed_at);
CREATE INDEX IF NOT EXISTS idx_notification_dlq_resolved_at ON notification_dead_letters(resolved_at);

COMMIT;
