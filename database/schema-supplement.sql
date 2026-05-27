-- schema-supplement.sql
-- Bổ sung cho schema TicketBox hiện tại.
-- Mục tiêu: per-user limit dưới tải cao, payment webhook idempotency, offline check-in device management,
-- notification DLQ và audit tồn kho vé.

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
    public_key TEXT,
    status device_status NOT NULL DEFAULT 'ACTIVE',
    last_sync_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_checkin_devices_staff FOREIGN KEY (staff_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_checkin_devices_concert FOREIGN KEY (concert_id) REFERENCES concerts(id) ON DELETE CASCADE,
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

CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_webhook_provider_event
    ON payment_webhook_events(provider, provider_event_id)
    WHERE provider_event_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_webhook_provider_transaction
    ON payment_webhook_events(provider, provider_transaction_id)
    WHERE provider_transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_ticket_counters_ticket_type ON user_ticket_type_counters(ticket_type_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_ticket_type ON order_items(order_id, ticket_type_id);
CREATE INDEX IF NOT EXISTS idx_inventory_events_ticket_type_created_at ON ticket_inventory_events(ticket_type_id, created_at);
CREATE INDEX IF NOT EXISTS idx_inventory_events_order_id ON ticket_inventory_events(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_webhook_order_received ON payment_webhook_events(order_id, received_at);
CREATE INDEX IF NOT EXISTS idx_payment_webhook_processed_received ON payment_webhook_events(processed, received_at);
CREATE INDEX IF NOT EXISTS idx_tickets_user_ticket_type_status ON tickets(user_id, ticket_type_id, status);
CREATE INDEX IF NOT EXISTS idx_checkin_devices_staff_status ON checkin_devices(staff_id, status);
CREATE INDEX IF NOT EXISTS idx_checkin_devices_concert_status ON checkin_devices(concert_id, status);
CREATE INDEX IF NOT EXISTS idx_notification_dlq_failed_at ON notification_dead_letters(failed_at);
CREATE INDEX IF NOT EXISTS idx_notification_dlq_resolved_at ON notification_dead_letters(resolved_at);

-- Nếu đang nâng cấp từ schema cũ, chạy thủ công phần dưới sau khi migrate dữ liệu device_id cũ sang checkin_devices:
-- ALTER TABLE checkin_logs ADD COLUMN IF NOT EXISTS device_uuid UUID REFERENCES checkin_devices(id) ON DELETE SET NULL;
-- ALTER TABLE offline_checkin_batches ADD COLUMN IF NOT EXISTS device_uuid UUID REFERENCES checkin_devices(id) ON DELETE RESTRICT;

COMMIT;
