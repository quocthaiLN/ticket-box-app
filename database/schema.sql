
-- schema.sql
-- PostgreSQL schema for TicketBox.
-- Designed for relational ticket ordering, payment, QR ticketing, offline check-in, AI artist bio jobs, guest-list import and audit logging.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE user_status AS ENUM ('ACTIVE', 'LOCKED', 'DISABLED');
CREATE TYPE concert_status AS ENUM ('DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED');
CREATE TYPE ticket_type_status AS ENUM ('DRAFT', 'ON_SALE', 'SOLD_OUT', 'CLOSED');
CREATE TYPE order_status AS ENUM ('PENDING', 'HELD', 'PAID', 'CANCELLED', 'EXPIRED', 'FAILED', 'REFUNDED');
CREATE TYPE payment_provider AS ENUM ('VNPAY', 'MOMO');
CREATE TYPE payment_status AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'REFUNDED');
CREATE TYPE ticket_status AS ENUM ('ISSUED', 'CHECKED_IN', 'CANCELLED', 'REFUNDED');
CREATE TYPE checkin_result AS ENUM ('SUCCESS', 'ALREADY_CHECKED_IN', 'INVALID_TICKET', 'WRONG_CONCERT', 'CONFLICT', 'ERROR');
CREATE TYPE offline_batch_status AS ENUM ('PENDING', 'SYNCING', 'DONE', 'FAILED');
CREATE TYPE offline_item_status AS ENUM ('PENDING', 'ACCEPTED', 'CONFLICT', 'INVALID', 'ERROR');
CREATE TYPE notification_channel AS ENUM ('APP', 'EMAIL', 'SMS', 'ZALO_OA');
CREATE TYPE notification_status AS ENUM ('PENDING', 'SENT', 'FAILED', 'RETRYING');
CREATE TYPE job_status AS ENUM ('PENDING', 'PROCESSING', 'DONE', 'FAILED');
CREATE TYPE import_status AS ENUM ('PENDING', 'PROCESSING', 'DONE', 'FAILED', 'PARTIAL');
CREATE TYPE guest_status AS ENUM ('INVITED', 'CHECKED_IN', 'CANCELLED');
CREATE TYPE idempotency_status AS ENUM ('PROCESSING', 'SUCCEEDED', 'FAILED');

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    password_hash TEXT NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    status user_status NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_users_email UNIQUE (email),
    CONSTRAINT uq_users_phone UNIQUE (phone),
    CONSTRAINT ck_users_email_format CHECK (position('@' in email) > 1),
    CONSTRAINT ck_users_phone_format CHECK (phone IS NULL OR phone ~ '^[0-9+]{8,20}$')
);

CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_roles_code UNIQUE (code),
    CONSTRAINT ck_roles_code CHECK (code IN ('CUSTOMER', 'ORGANIZER', 'CHECKIN_STAFF', 'ADMIN'))
);

CREATE TABLE user_roles (
    user_id UUID NOT NULL,
    role_id UUID NOT NULL,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, role_id),
    CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_roles_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
);

CREATE TABLE venues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    capacity INTEGER NOT NULL,
    map_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_venues_capacity_positive CHECK (capacity > 0)
);

CREATE TABLE concerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venue_id UUID NOT NULL,
    organizer_id UUID,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    description TEXT,
    artist_name VARCHAR(255),
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    status concert_status NOT NULL DEFAULT 'DRAFT',
    cover_image_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_concerts_slug UNIQUE (slug),
    CONSTRAINT fk_concerts_venue FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE RESTRICT,
    CONSTRAINT fk_concerts_organizer FOREIGN KEY (organizer_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT ck_concerts_time_range CHECK (ends_at > starts_at)
);

CREATE TABLE seat_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    concert_id UUID NOT NULL,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    capacity INTEGER NOT NULL,
    svg_path TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_seat_zones_concert FOREIGN KEY (concert_id) REFERENCES concerts(id) ON DELETE CASCADE,
    CONSTRAINT uq_seat_zones_concert_code UNIQUE (concert_id, code),
    CONSTRAINT ck_seat_zones_capacity_positive CHECK (capacity > 0)
);

CREATE TABLE ticket_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    concert_id UUID NOT NULL,
    seat_zone_id UUID NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price NUMERIC(12,2) NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'VND',
    total_quantity INTEGER NOT NULL,
    available_quantity INTEGER NOT NULL,
    held_quantity INTEGER NOT NULL DEFAULT 0,
    sold_quantity INTEGER NOT NULL DEFAULT 0,
    max_per_user INTEGER NOT NULL,
    sale_start_at TIMESTAMPTZ NOT NULL,
    sale_end_at TIMESTAMPTZ NOT NULL,
    status ticket_type_status NOT NULL DEFAULT 'DRAFT',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_ticket_types_concert FOREIGN KEY (concert_id) REFERENCES concerts(id) ON DELETE CASCADE,
    CONSTRAINT fk_ticket_types_seat_zone FOREIGN KEY (seat_zone_id) REFERENCES seat_zones(id) ON DELETE RESTRICT,
    CONSTRAINT uq_ticket_types_concert_name UNIQUE (concert_id, name),
    CONSTRAINT ck_ticket_types_price_non_negative CHECK (price >= 0),
    CONSTRAINT ck_ticket_types_quantities_non_negative CHECK (total_quantity >= 0 AND available_quantity >= 0 AND held_quantity >= 0 AND sold_quantity >= 0),
    CONSTRAINT ck_ticket_types_quantity_sum CHECK (total_quantity = available_quantity + held_quantity + sold_quantity),
    CONSTRAINT ck_ticket_types_max_per_user_positive CHECK (max_per_user > 0),
    CONSTRAINT ck_ticket_types_sale_time_range CHECK (sale_end_at > sale_start_at)
);

CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    concert_id UUID NOT NULL,
    status order_status NOT NULL DEFAULT 'PENDING',
    total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    currency CHAR(3) NOT NULL DEFAULT 'VND',
    hold_expires_at TIMESTAMPTZ,
    cancelled_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_orders_concert FOREIGN KEY (concert_id) REFERENCES concerts(id) ON DELETE RESTRICT,
    CONSTRAINT ck_orders_total_amount_non_negative CHECK (total_amount >= 0),
    CONSTRAINT ck_orders_hold_expiry_required CHECK (status <> 'HELD' OR hold_expires_at IS NOT NULL)
);

CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL,
    ticket_type_id UUID NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price NUMERIC(12,2) NOT NULL,
    line_total NUMERIC(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    CONSTRAINT fk_order_items_ticket_type FOREIGN KEY (ticket_type_id) REFERENCES ticket_types(id) ON DELETE RESTRICT,
    CONSTRAINT ck_order_items_quantity_positive CHECK (quantity > 0),
    CONSTRAINT ck_order_items_unit_price_non_negative CHECK (unit_price >= 0)
);

CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL,
    provider payment_provider NOT NULL,
    provider_transaction_id VARCHAR(255),
    amount NUMERIC(12,2) NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'VND',
    status payment_status NOT NULL DEFAULT 'PENDING',
    provider_payload JSONB,
    paid_at TIMESTAMPTZ,
    failure_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT,
    CONSTRAINT ck_payments_amount_positive CHECK (amount > 0),
    CONSTRAINT ck_payments_paid_at_required CHECK (status <> 'SUCCEEDED' OR paid_at IS NOT NULL)
);

CREATE TABLE idempotency_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    key VARCHAR(128) NOT NULL,
    request_hash VARCHAR(128) NOT NULL,
    status idempotency_status NOT NULL DEFAULT 'PROCESSING',
    response_code INTEGER,
    response_body JSONB,
    order_id UUID,
    locked_until TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_idempotency_keys_key UNIQUE (key),
    CONSTRAINT fk_idempotency_keys_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_idempotency_keys_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
    CONSTRAINT ck_idempotency_keys_expires_after_created CHECK (expires_at > created_at)
);

CREATE TABLE tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL,
    order_item_id UUID NOT NULL,
    user_id UUID NOT NULL,
    concert_id UUID NOT NULL,
    ticket_type_id UUID NOT NULL,
    seat_zone_id UUID NOT NULL,
    qr_token VARCHAR(255) NOT NULL,
    qr_signature TEXT NOT NULL,
    status ticket_status NOT NULL DEFAULT 'ISSUED',
    issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    checked_in_at TIMESTAMPTZ,
    checked_in_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_tickets_qr_token UNIQUE (qr_token),
    CONSTRAINT fk_tickets_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT,
    CONSTRAINT fk_tickets_order_item FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE RESTRICT,
    CONSTRAINT fk_tickets_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_tickets_concert FOREIGN KEY (concert_id) REFERENCES concerts(id) ON DELETE RESTRICT,
    CONSTRAINT fk_tickets_ticket_type FOREIGN KEY (ticket_type_id) REFERENCES ticket_types(id) ON DELETE RESTRICT,
    CONSTRAINT fk_tickets_seat_zone FOREIGN KEY (seat_zone_id) REFERENCES seat_zones(id) ON DELETE RESTRICT,
    CONSTRAINT fk_tickets_checked_in_by FOREIGN KEY (checked_in_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT ck_tickets_checked_in_at_required CHECK (status <> 'CHECKED_IN' OR checked_in_at IS NOT NULL)
);

CREATE TABLE checkin_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID,
    concert_id UUID NOT NULL,
    staff_id UUID,
    gate_code VARCHAR(50),
    device_id VARCHAR(100),
    scan_token TEXT NOT NULL,
    result checkin_result NOT NULL,
    reason TEXT,
    scanned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    synced_at TIMESTAMPTZ,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_checkin_logs_ticket FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE SET NULL,
    CONSTRAINT fk_checkin_logs_concert FOREIGN KEY (concert_id) REFERENCES concerts(id) ON DELETE RESTRICT,
    CONSTRAINT fk_checkin_logs_staff FOREIGN KEY (staff_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE offline_checkin_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    concert_id UUID NOT NULL,
    staff_id UUID,
    device_id VARCHAR(100) NOT NULL,
    batch_token VARCHAR(128) NOT NULL,
    status offline_batch_status NOT NULL DEFAULT 'PENDING',
    item_count INTEGER NOT NULL DEFAULT 0,
    conflict_count INTEGER NOT NULL DEFAULT 0,
    started_at TIMESTAMPTZ NOT NULL,
    synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_offline_checkin_batches_token UNIQUE (batch_token),
    CONSTRAINT fk_offline_batches_concert FOREIGN KEY (concert_id) REFERENCES concerts(id) ON DELETE RESTRICT,
    CONSTRAINT fk_offline_batches_staff FOREIGN KEY (staff_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT ck_offline_batches_counts_non_negative CHECK (item_count >= 0 AND conflict_count >= 0)
);

CREATE TABLE offline_checkin_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL,
    ticket_id UUID,
    guest_id UUID,
    qr_token TEXT,
    local_scanned_at TIMESTAMPTZ NOT NULL,
    sync_result offline_item_status NOT NULL DEFAULT 'PENDING',
    conflict_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_offline_items_batch FOREIGN KEY (batch_id) REFERENCES offline_checkin_batches(id) ON DELETE CASCADE,
    CONSTRAINT fk_offline_items_ticket FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE SET NULL,
    CONSTRAINT uq_offline_items_batch_qr UNIQUE (batch_id, qr_token),
    CONSTRAINT ck_offline_items_has_target CHECK (qr_token IS NOT NULL OR guest_id IS NOT NULL)
);

CREATE TABLE notification_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(100) NOT NULL,
    channel notification_channel NOT NULL,
    subject VARCHAR(255),
    body TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_notification_templates_code_channel UNIQUE (code, channel)
);

CREATE TABLE notification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID,
    user_id UUID,
    concert_id UUID,
    ticket_id UUID,
    channel notification_channel NOT NULL,
    destination VARCHAR(255) NOT NULL,
    status notification_status NOT NULL DEFAULT 'PENDING',
    provider_message_id VARCHAR(255),
    error_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    scheduled_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_notification_logs_template FOREIGN KEY (template_id) REFERENCES notification_templates(id) ON DELETE SET NULL,
    CONSTRAINT fk_notification_logs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_notification_logs_concert FOREIGN KEY (concert_id) REFERENCES concerts(id) ON DELETE SET NULL,
    CONSTRAINT fk_notification_logs_ticket FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE SET NULL,
    CONSTRAINT ck_notification_logs_retry_count_non_negative CHECK (retry_count >= 0),
    CONSTRAINT ck_notification_logs_sent_at_required CHECK (status <> 'SENT' OR sent_at IS NOT NULL)
);

CREATE TABLE artist_bio_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    concert_id UUID NOT NULL,
    uploaded_by UUID,
    source_file_url TEXT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    status job_status NOT NULL DEFAULT 'PENDING',
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    CONSTRAINT fk_artist_bio_jobs_concert FOREIGN KEY (concert_id) REFERENCES concerts(id) ON DELETE CASCADE,
    CONSTRAINT fk_artist_bio_jobs_uploaded_by FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT ck_artist_bio_jobs_file_size_positive CHECK (file_size_bytes > 0)
);

CREATE TABLE artist_bios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    concert_id UUID NOT NULL,
    job_id UUID,
    bio_text TEXT NOT NULL,
    language CHAR(2) NOT NULL DEFAULT 'vi',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_artist_bios_concert FOREIGN KEY (concert_id) REFERENCES concerts(id) ON DELETE CASCADE,
    CONSTRAINT fk_artist_bios_job FOREIGN KEY (job_id) REFERENCES artist_bio_jobs(id) ON DELETE SET NULL,
    CONSTRAINT ck_artist_bios_bio_text_not_empty CHECK (length(trim(bio_text)) > 0)
);

CREATE TABLE guest_import_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    concert_id UUID NOT NULL,
    uploaded_by UUID,
    source_file_url TEXT,
    source_file_name VARCHAR(255),
    status import_status NOT NULL DEFAULT 'PENDING',
    total_rows INTEGER NOT NULL DEFAULT 0,
    success_rows INTEGER NOT NULL DEFAULT 0,
    error_rows INTEGER NOT NULL DEFAULT 0,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_guest_import_jobs_concert FOREIGN KEY (concert_id) REFERENCES concerts(id) ON DELETE CASCADE,
    CONSTRAINT fk_guest_import_jobs_uploaded_by FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT ck_guest_import_jobs_counts_non_negative CHECK (total_rows >= 0 AND success_rows >= 0 AND error_rows >= 0),
    CONSTRAINT ck_guest_import_jobs_counts_valid CHECK (success_rows + error_rows <= total_rows)
);

CREATE TABLE guest_list (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    concert_id UUID NOT NULL,
    seat_zone_id UUID,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    sponsor_name VARCHAR(255),
    status guest_status NOT NULL DEFAULT 'INVITED',
    checked_in_at TIMESTAMPTZ,
    checked_in_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_guest_list_concert FOREIGN KEY (concert_id) REFERENCES concerts(id) ON DELETE CASCADE,
    CONSTRAINT fk_guest_list_seat_zone FOREIGN KEY (seat_zone_id) REFERENCES seat_zones(id) ON DELETE SET NULL,
    CONSTRAINT fk_guest_list_checked_in_by FOREIGN KEY (checked_in_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT uq_guest_list_concert_phone UNIQUE (concert_id, phone),
    CONSTRAINT ck_guest_list_phone_format CHECK (phone ~ '^[0-9+]{8,20}$'),
    CONSTRAINT ck_guest_list_checked_in_at_required CHECK (status <> 'CHECKED_IN' OR checked_in_at IS NOT NULL)
);

ALTER TABLE offline_checkin_items
    ADD CONSTRAINT fk_offline_items_guest FOREIGN KEY (guest_id) REFERENCES guest_list(id) ON DELETE SET NULL;

CREATE TABLE guest_import_errors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL,
    row_number INTEGER NOT NULL,
    raw_data JSONB,
    error_message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_guest_import_errors_job FOREIGN KEY (job_id) REFERENCES guest_import_jobs(id) ON DELETE CASCADE,
    CONSTRAINT ck_guest_import_errors_row_number_positive CHECK (row_number > 0)
);

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id UUID,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID,
    before_data JSONB,
    after_data JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_audit_logs_actor FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Unique indexes that cannot be expressed as normal constraints.
CREATE UNIQUE INDEX uq_payments_provider_transaction
    ON payments(provider, provider_transaction_id)
    WHERE provider_transaction_id IS NOT NULL;

CREATE UNIQUE INDEX uq_artist_bios_one_active_per_concert
    ON artist_bios(concert_id)
    WHERE is_active = TRUE;

-- Query indexes.
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_user_roles_role_id ON user_roles(role_id);
CREATE INDEX idx_concerts_status_starts_at ON concerts(status, starts_at);
CREATE INDEX idx_concerts_venue_id ON concerts(venue_id);
CREATE INDEX idx_seat_zones_concert_id ON seat_zones(concert_id);
CREATE INDEX idx_ticket_types_concert_status ON ticket_types(concert_id, status);
CREATE INDEX idx_ticket_types_sale_window ON ticket_types(sale_start_at, sale_end_at);
CREATE INDEX idx_orders_user_status_created_at ON orders(user_id, status, created_at);
CREATE INDEX idx_orders_concert_status ON orders(concert_id, status);
CREATE INDEX idx_order_items_ticket_type_id ON order_items(ticket_type_id);
CREATE INDEX idx_payments_order_status ON payments(order_id, status);
CREATE INDEX idx_idempotency_keys_user_expires ON idempotency_keys(user_id, expires_at);
CREATE INDEX idx_tickets_order_id ON tickets(order_id);
CREATE INDEX idx_tickets_user_concert_status ON tickets(user_id, concert_id, status);
CREATE INDEX idx_tickets_ticket_type_status ON tickets(ticket_type_id, status);
CREATE INDEX idx_tickets_checked_in_at ON tickets(checked_in_at);
CREATE INDEX idx_checkin_logs_ticket_scanned_at ON checkin_logs(ticket_id, scanned_at);
CREATE INDEX idx_checkin_logs_concert_scanned_at ON checkin_logs(concert_id, scanned_at);
CREATE INDEX idx_offline_batches_concert_status ON offline_checkin_batches(concert_id, status);
CREATE INDEX idx_offline_items_batch_result ON offline_checkin_items(batch_id, sync_result);
CREATE INDEX idx_notification_logs_status_scheduled_at ON notification_logs(status, scheduled_at);
CREATE INDEX idx_notification_logs_user_created_at ON notification_logs(user_id, created_at);
CREATE INDEX idx_artist_bio_jobs_concert_status ON artist_bio_jobs(concert_id, status);
CREATE INDEX idx_guest_import_jobs_concert_status ON guest_import_jobs(concert_id, status);
CREATE INDEX idx_guest_import_errors_job_id ON guest_import_errors(job_id);
CREATE INDEX idx_guest_list_concert_status ON guest_list(concert_id, status);
CREATE INDEX idx_guest_list_phone ON guest_list(phone);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id, created_at);
CREATE INDEX idx_audit_logs_actor_created_at ON audit_logs(actor_user_id, created_at);

-- updated_at triggers.
CREATE TRIGGER trg_users_set_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_venues_set_updated_at BEFORE UPDATE ON venues FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_concerts_set_updated_at BEFORE UPDATE ON concerts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_seat_zones_set_updated_at BEFORE UPDATE ON seat_zones FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_ticket_types_set_updated_at BEFORE UPDATE ON ticket_types FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_orders_set_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_payments_set_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_idempotency_keys_set_updated_at BEFORE UPDATE ON idempotency_keys FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_tickets_set_updated_at BEFORE UPDATE ON tickets FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_offline_checkin_batches_set_updated_at BEFORE UPDATE ON offline_checkin_batches FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_notification_templates_set_updated_at BEFORE UPDATE ON notification_templates FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_artist_bio_jobs_set_updated_at BEFORE UPDATE ON artist_bio_jobs FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_artist_bios_set_updated_at BEFORE UPDATE ON artist_bios FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_guest_import_jobs_set_updated_at BEFORE UPDATE ON guest_import_jobs FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_guest_list_set_updated_at BEFORE UPDATE ON guest_list FOR EACH ROW EXECUTE FUNCTION set_updated_at();


COMMENT ON TABLE users IS 'Lưu tài khoản người dùng của TicketBox, bao gồm khán giả, ban tổ chức, nhân sự soát vé và admin.';
COMMENT ON COLUMN users.id IS 'Định danh duy nhất của user. Dùng làm khóa chính và liên kết sang đơn hàng, vai trò, audit, check-in.';
COMMENT ON COLUMN users.email IS 'Email đăng nhập. Chống trùng tài khoản và dùng cho thông báo email.';
COMMENT ON COLUMN users.password_hash IS 'Mật khẩu đã hash. Xác thực đăng nhập, không lưu mật khẩu thô.';
COMMENT ON COLUMN users.full_name IS 'Họ tên người dùng. Hiển thị trên tài khoản, vé, guest/admin.';
COMMENT ON COLUMN users.phone IS 'Số điện thoại. Liên hệ, đối soát khách mời, chống trùng khi cần.';
COMMENT ON COLUMN users.status IS 'Trạng thái tài khoản. Khóa hoặc vô hiệu hóa user khi phát hiện rủi ro.';
COMMENT ON COLUMN users.created_at IS 'Thời điểm tạo. Audit/debug.';
COMMENT ON COLUMN users.updated_at IS 'Thời điểm cập nhật. Theo dõi thay đổi hồ sơ.';
COMMENT ON TABLE roles IS 'Lưu danh mục vai trò phục vụ RBAC.';
COMMENT ON COLUMN roles.id IS 'Định danh role. Khóa chính cho user_roles.';
COMMENT ON COLUMN roles.code IS 'Mã vai trò. Phân quyền CUSTOMER/ORGANIZER/CHECKIN_STAFF/ADMIN.';
COMMENT ON COLUMN roles.name IS 'Tên hiển thị role. Hiển thị trên admin.';
COMMENT ON COLUMN roles.description IS 'Mô tả quyền. Giải thích phạm vi role.';
COMMENT ON COLUMN roles.created_at IS 'Thời điểm tạo. Audit danh mục quyền.';
COMMENT ON TABLE user_roles IS 'Bảng nối nhiều-nhiều giữa users và roles.';
COMMENT ON COLUMN user_roles.user_id IS 'User được gán quyền. Liên kết tài khoản với role.';
COMMENT ON COLUMN user_roles.role_id IS 'Role được gán. Cho phép một user có nhiều vai trò.';
COMMENT ON COLUMN user_roles.assigned_at IS 'Thời điểm gán quyền. Audit phân quyền.';
COMMENT ON TABLE venues IS 'Lưu địa điểm tổ chức concert.';
COMMENT ON COLUMN venues.id IS 'Định danh venue. Liên kết concert.';
COMMENT ON COLUMN venues.name IS 'Tên địa điểm. Hiển thị chi tiết concert.';
COMMENT ON COLUMN venues.address IS 'Địa chỉ. Hiển thị và gửi reminder.';
COMMENT ON COLUMN venues.city IS 'Thành phố. Lọc concert theo khu vực.';
COMMENT ON COLUMN venues.capacity IS 'Sức chứa. Kiểm tra hợp lý tổng số vé/khu.';
COMMENT ON COLUMN venues.map_url IS 'Link bản đồ. Hỗ trợ người mua tìm địa điểm.';
COMMENT ON COLUMN venues.created_at IS 'Thời điểm tạo. Audit.';
COMMENT ON COLUMN venues.updated_at IS 'Thời điểm cập nhật. Audit.';
COMMENT ON TABLE concerts IS 'Lưu thông tin chính của concert.';
COMMENT ON COLUMN concerts.id IS 'Định danh concert. Khóa liên kết toàn bộ module vé, bio, guest list.';
COMMENT ON COLUMN concerts.venue_id IS 'Địa điểm tổ chức. Gắn concert với venue.';
COMMENT ON COLUMN concerts.organizer_id IS 'Ban tổ chức phụ trách. Phân quyền quản trị concert.';
COMMENT ON COLUMN concerts.title IS 'Tên concert. Hiển thị danh sách/chi tiết.';
COMMENT ON COLUMN concerts.slug IS 'Đường dẫn thân thiện. Dùng cho URL chi tiết concert.';
COMMENT ON COLUMN concerts.description IS 'Mô tả concert. Hiển thị thông tin sự kiện.';
COMMENT ON COLUMN concerts.artist_name IS 'Tên nghệ sĩ/lineup chính. Tìm kiếm và hiển thị.';
COMMENT ON COLUMN concerts.starts_at IS 'Thời điểm bắt đầu. Sắp xếp, nhắc lịch.';
COMMENT ON COLUMN concerts.ends_at IS 'Thời điểm kết thúc. Kiểm tra thời gian hợp lệ.';
COMMENT ON COLUMN concerts.status IS 'Trạng thái concert. Ẩn/hiện, hủy, hoàn tất.';
COMMENT ON COLUMN concerts.cover_image_url IS 'Ảnh bìa. Hiển thị UI.';
COMMENT ON COLUMN concerts.created_at IS 'Thời điểm tạo. Audit.';
COMMENT ON COLUMN concerts.updated_at IS 'Thời điểm cập nhật. Invalidate cache khi thay đổi.';
COMMENT ON TABLE seat_zones IS 'Lưu khu vực ghế/chỗ đứng của từng concert như GA, SVIP, VIP, CAT1, CAT2.';
COMMENT ON COLUMN seat_zones.id IS 'Định danh khu. Liên kết loại vé và guest list.';
COMMENT ON COLUMN seat_zones.concert_id IS 'Concert sở hữu khu. Xóa concert thì xóa khu.';
COMMENT ON COLUMN seat_zones.code IS 'Mã khu. GA/SVIP/VIP/CAT1/CAT2.';
COMMENT ON COLUMN seat_zones.name IS 'Tên khu. Hiển thị sơ đồ vé.';
COMMENT ON COLUMN seat_zones.description IS 'Mô tả khu. Mô tả quyền lợi/vị trí.';
COMMENT ON COLUMN seat_zones.capacity IS 'Sức chứa khu. Kiểm tra tổng vé trong khu.';
COMMENT ON COLUMN seat_zones.svg_path IS 'Dữ liệu path SVG. Render sơ đồ ghế tương tác.';
COMMENT ON COLUMN seat_zones.sort_order IS 'Thứ tự hiển thị. Sắp xếp khu trên UI.';
COMMENT ON COLUMN seat_zones.created_at IS 'Thời điểm tạo. Audit.';
COMMENT ON COLUMN seat_zones.updated_at IS 'Thời điểm cập nhật. Audit/cache invalidation.';
COMMENT ON TABLE ticket_types IS 'Lưu từng loại vé, giá, kho vé, thời gian mở bán và giới hạn mua mỗi tài khoản.';
COMMENT ON COLUMN ticket_types.id IS 'Định danh loại vé. Khóa chính cho order_items/tickets.';
COMMENT ON COLUMN ticket_types.concert_id IS 'Concert áp dụng. Lọc loại vé theo concert.';
COMMENT ON COLUMN ticket_types.seat_zone_id IS 'Khu vực áp dụng. Gắn loại vé với sơ đồ chỗ ngồi.';
COMMENT ON COLUMN ticket_types.name IS 'Tên loại vé. Ví dụ SVIP Standard.';
COMMENT ON COLUMN ticket_types.description IS 'Mô tả quyền lợi. Hiển thị cho người mua.';
COMMENT ON COLUMN ticket_types.price IS 'Giá vé. Tính tiền đơn hàng.';
COMMENT ON COLUMN ticket_types.currency IS 'Đơn vị tiền. Hỗ trợ payment.';
COMMENT ON COLUMN ticket_types.total_quantity IS 'Tổng số vé. Giới hạn nguồn cung.';
COMMENT ON COLUMN ticket_types.available_quantity IS 'Số vé còn có thể bán. Dùng lock transaction chống oversell.';
COMMENT ON COLUMN ticket_types.held_quantity IS 'Số vé đang giữ tạm. Dùng hold vé khi chờ thanh toán.';
COMMENT ON COLUMN ticket_types.sold_quantity IS 'Số vé đã bán. Thống kê và đối soát.';
COMMENT ON COLUMN ticket_types.max_per_user IS 'Giới hạn mua/user. Chống gom vé quá số lượng.';
COMMENT ON COLUMN ticket_types.sale_start_at IS 'Mở bán từ. Chặn mua sớm.';
COMMENT ON COLUMN ticket_types.sale_end_at IS 'Kết thúc bán. Chặn mua sau thời hạn.';
COMMENT ON COLUMN ticket_types.status IS 'Trạng thái bán. Bật/tắt bán vé.';
COMMENT ON COLUMN ticket_types.created_at IS 'Thời điểm tạo. Audit.';
COMMENT ON COLUMN ticket_types.updated_at IS 'Thời điểm cập nhật. Audit/cache invalidation.';
COMMENT ON TABLE orders IS 'Lưu đơn đặt vé của người dùng, trạng thái giữ vé, thanh toán và hoàn tiền.';
COMMENT ON COLUMN orders.id IS 'Định danh đơn hàng. Khóa liên kết items/payment/tickets.';
COMMENT ON COLUMN orders.user_id IS 'Người mua. Kiểm soát lịch sử mua và giới hạn per-user.';
COMMENT ON COLUMN orders.concert_id IS 'Concert được mua. Tổng hợp doanh thu theo concert.';
COMMENT ON COLUMN orders.status IS 'Trạng thái đơn. PENDING/HELD/PAID/CANCELLED/EXPIRED/FAILED/REFUNDED.';
COMMENT ON COLUMN orders.total_amount IS 'Tổng tiền. Đối chiếu payment.';
COMMENT ON COLUMN orders.currency IS 'Đơn vị tiền. Khớp cổng thanh toán.';
COMMENT ON COLUMN orders.hold_expires_at IS 'Hạn giữ vé. Giải phóng vé khi quá hạn.';
COMMENT ON COLUMN orders.cancelled_reason IS 'Lý do hủy. Debug/support.';
COMMENT ON COLUMN orders.created_at IS 'Thời điểm tạo. Audit.';
COMMENT ON COLUMN orders.updated_at IS 'Thời điểm cập nhật. Theo dõi luồng xử lý.';
COMMENT ON TABLE order_items IS 'Lưu từng dòng vé trong một đơn hàng.';
COMMENT ON COLUMN order_items.id IS 'Định danh dòng đơn. Khóa liên kết tickets.';
COMMENT ON COLUMN order_items.order_id IS 'Đơn hàng cha. Một đơn có nhiều loại vé.';
COMMENT ON COLUMN order_items.ticket_type_id IS 'Loại vé đã chọn. Kiểm tra kho và phát hành vé.';
COMMENT ON COLUMN order_items.quantity IS 'Số lượng. Tính kho và tổng tiền.';
COMMENT ON COLUMN order_items.unit_price IS 'Giá tại thời điểm mua. Giữ nguyên lịch sử nếu giá đổi.';
COMMENT ON COLUMN order_items.line_total IS 'Thành tiền dòng. Tự động = quantity * unit_price.';
COMMENT ON COLUMN order_items.created_at IS 'Thời điểm tạo. Audit.';
COMMENT ON TABLE payments IS 'Lưu giao dịch thanh toán qua VNPAY/MoMo và kết quả webhook/IPN.';
COMMENT ON COLUMN payments.id IS 'Định danh payment. Khóa chính giao dịch.';
COMMENT ON COLUMN payments.order_id IS 'Đơn hàng được thanh toán. Đối soát trạng thái đơn.';
COMMENT ON COLUMN payments.provider IS 'Cổng thanh toán. VNPAY hoặc MOMO.';
COMMENT ON COLUMN payments.provider_transaction_id IS 'Mã giao dịch từ cổng. Chống xử lý webhook trùng.';
COMMENT ON COLUMN payments.amount IS 'Số tiền thanh toán. Đối chiếu với orders.total_amount.';
COMMENT ON COLUMN payments.currency IS 'Đơn vị tiền. Đối chiếu gateway.';
COMMENT ON COLUMN payments.status IS 'Trạng thái payment. PENDING/SUCCEEDED/FAILED/CANCELLED/REFUNDED.';
COMMENT ON COLUMN payments.provider_payload IS 'Payload gốc từ cổng. Audit/debug webhook.';
COMMENT ON COLUMN payments.paid_at IS 'Thời điểm thanh toán thành công. Đối soát doanh thu.';
COMMENT ON COLUMN payments.failure_reason IS 'Lý do thất bại. Support/debug.';
COMMENT ON COLUMN payments.created_at IS 'Thời điểm tạo. Audit.';
COMMENT ON COLUMN payments.updated_at IS 'Thời điểm cập nhật. Audit.';
COMMENT ON TABLE idempotency_keys IS 'Lưu idempotency key để chống tạo đơn/thanh toán trùng khi user bấm nhiều lần hoặc webhook retry.';
COMMENT ON COLUMN idempotency_keys.id IS 'Định danh record. Khóa chính.';
COMMENT ON COLUMN idempotency_keys.user_id IS 'User gửi request. Giới hạn key theo tài khoản.';
COMMENT ON COLUMN idempotency_keys.key IS 'Idempotency key. Chống request trùng.';
COMMENT ON COLUMN idempotency_keys.request_hash IS 'Hash payload request. Phát hiện cùng key nhưng khác payload.';
COMMENT ON COLUMN idempotency_keys.status IS 'Trạng thái xử lý. PROCESSING/SUCCEEDED/FAILED.';
COMMENT ON COLUMN idempotency_keys.response_code IS 'HTTP status đã trả. Replay response cũ.';
COMMENT ON COLUMN idempotency_keys.response_body IS 'Body đã trả. Replay response cũ.';
COMMENT ON COLUMN idempotency_keys.order_id IS 'Đơn hàng liên quan. Trả lại đúng đơn đã tạo.';
COMMENT ON COLUMN idempotency_keys.locked_until IS 'Khóa xử lý tạm. Tránh hai worker xử lý một key.';
COMMENT ON COLUMN idempotency_keys.expires_at IS 'Hạn lưu key. Dọn key ngắn hạn.';
COMMENT ON COLUMN idempotency_keys.created_at IS 'Thời điểm tạo. Audit.';
COMMENT ON COLUMN idempotency_keys.updated_at IS 'Thời điểm cập nhật. Audit.';
COMMENT ON TABLE tickets IS 'Lưu từng e-ticket QR cụ thể được phát hành sau khi thanh toán thành công.';
COMMENT ON COLUMN tickets.id IS 'Định danh vé. Khóa chính vé.';
COMMENT ON COLUMN tickets.order_id IS 'Đơn phát hành vé. Truy xuất nguồn gốc.';
COMMENT ON COLUMN tickets.order_item_id IS 'Dòng đơn phát hành vé. Biết vé thuộc loại nào trong đơn.';
COMMENT ON COLUMN tickets.user_id IS 'Chủ sở hữu vé. Hiển thị Vé của tôi.';
COMMENT ON COLUMN tickets.concert_id IS 'Concert của vé. Check-in đúng concert.';
COMMENT ON COLUMN tickets.ticket_type_id IS 'Loại vé. Thống kê và phân quyền cổng.';
COMMENT ON COLUMN tickets.seat_zone_id IS 'Khu vực vé. Điều hướng vào cổng/khu.';
COMMENT ON COLUMN tickets.qr_token IS 'Token QR. Xác thực vé khi quét.';
COMMENT ON COLUMN tickets.qr_signature IS 'Chữ ký QR. Hỗ trợ kiểm tra toàn vẹn/offline.';
COMMENT ON COLUMN tickets.status IS 'Trạng thái vé. ISSUED/CHECKED_IN/CANCELLED/REFUNDED.';
COMMENT ON COLUMN tickets.issued_at IS 'Thời điểm phát hành. Gửi e-ticket.';
COMMENT ON COLUMN tickets.checked_in_at IS 'Thời điểm vào cổng. Chống quét lại.';
COMMENT ON COLUMN tickets.checked_in_by IS 'Nhân sự soát vé. Audit check-in.';
COMMENT ON COLUMN tickets.created_at IS 'Thời điểm tạo. Audit.';
COMMENT ON COLUMN tickets.updated_at IS 'Thời điểm cập nhật. Audit.';
COMMENT ON TABLE checkin_logs IS 'Lưu lịch sử mọi lần quét vé, kể cả thành công, vé giả, vé đã quét hoặc conflict.';
COMMENT ON COLUMN checkin_logs.id IS 'Định danh log. Khóa chính.';
COMMENT ON COLUMN checkin_logs.ticket_id IS 'Vé được quét. Có thể null nếu QR không hợp lệ.';
COMMENT ON COLUMN checkin_logs.concert_id IS 'Concert đang soát. Phân vùng log theo sự kiện.';
COMMENT ON COLUMN checkin_logs.staff_id IS 'Nhân sự quét. Audit trách nhiệm.';
COMMENT ON COLUMN checkin_logs.gate_code IS 'Mã cổng. Phân tích tải từng cổng.';
COMMENT ON COLUMN checkin_logs.device_id IS 'Thiết bị quét. Audit thiết bị.';
COMMENT ON COLUMN checkin_logs.scan_token IS 'Token/raw QR được quét. Ghi nhận đầu vào kiểm tra.';
COMMENT ON COLUMN checkin_logs.result IS 'Kết quả quét. SUCCESS/ALREADY_CHECKED_IN/INVALID/CONFLICT.';
COMMENT ON COLUMN checkin_logs.reason IS 'Lý do lỗi. Hiển thị/debug.';
COMMENT ON COLUMN checkin_logs.scanned_at IS 'Thời điểm quét. Dòng thời gian check-in.';
COMMENT ON COLUMN checkin_logs.synced_at IS 'Thời điểm đồng bộ. Phân biệt online/offline sync.';
COMMENT ON COLUMN checkin_logs.metadata IS 'Dữ liệu bổ sung. Lưu IP, app version, tọa độ nếu có.';
COMMENT ON COLUMN checkin_logs.created_at IS 'Thời điểm ghi DB. Audit.';
COMMENT ON TABLE offline_checkin_batches IS 'Lưu một đợt đồng bộ các lượt check-in offline từ mobile app.';
COMMENT ON COLUMN offline_checkin_batches.id IS 'Định danh batch. Khóa chính.';
COMMENT ON COLUMN offline_checkin_batches.concert_id IS 'Concert đồng bộ. Xác định phạm vi vé.';
COMMENT ON COLUMN offline_checkin_batches.staff_id IS 'Nhân sự dùng thiết bị. Audit.';
COMMENT ON COLUMN offline_checkin_batches.device_id IS 'Thiết bị offline. Phát hiện nguồn conflict.';
COMMENT ON COLUMN offline_checkin_batches.batch_token IS 'Mã batch. Chống gửi batch trùng.';
COMMENT ON COLUMN offline_checkin_batches.status IS 'Trạng thái sync. PENDING/SYNCING/DONE/FAILED.';
COMMENT ON COLUMN offline_checkin_batches.item_count IS 'Số item. Đối chiếu dữ liệu đồng bộ.';
COMMENT ON COLUMN offline_checkin_batches.conflict_count IS 'Số conflict. Theo dõi vé quét trùng.';
COMMENT ON COLUMN offline_checkin_batches.started_at IS 'Thời điểm bắt đầu offline. Audit.';
COMMENT ON COLUMN offline_checkin_batches.synced_at IS 'Thời điểm sync server. Kiểm tra độ trễ.';
COMMENT ON COLUMN offline_checkin_batches.created_at IS 'Thời điểm tạo. Audit.';
COMMENT ON COLUMN offline_checkin_batches.updated_at IS 'Thời điểm cập nhật. Audit.';
COMMENT ON TABLE offline_checkin_items IS 'Lưu từng lượt quét trong batch offline và kết quả đồng bộ/conflict.';
COMMENT ON COLUMN offline_checkin_items.id IS 'Định danh item. Khóa chính.';
COMMENT ON COLUMN offline_checkin_items.batch_id IS 'Batch cha. Xóa batch thì xóa item.';
COMMENT ON COLUMN offline_checkin_items.ticket_id IS 'Vé sau khi resolve. Có thể null khi chưa resolve.';
COMMENT ON COLUMN offline_checkin_items.guest_id IS 'Khách mời VIP. Hỗ trợ check-in guest offline.';
COMMENT ON COLUMN offline_checkin_items.qr_token IS 'QR token local. Dùng resolve vé khi sync.';
COMMENT ON COLUMN offline_checkin_items.local_scanned_at IS 'Thời điểm quét trên máy. Giữ thứ tự sự kiện offline.';
COMMENT ON COLUMN offline_checkin_items.sync_result IS 'Kết quả sync. ACCEPTED/CONFLICT/INVALID/ERROR.';
COMMENT ON COLUMN offline_checkin_items.conflict_reason IS 'Lý do conflict. Giải thích vé quét trùng.';
COMMENT ON COLUMN offline_checkin_items.created_at IS 'Thời điểm ghi server. Audit.';
COMMENT ON TABLE notification_templates IS 'Lưu mẫu thông báo theo kênh để dễ mở rộng APP/EMAIL/SMS/Zalo OA.';
COMMENT ON COLUMN notification_templates.id IS 'Định danh template. Khóa chính.';
COMMENT ON COLUMN notification_templates.code IS 'Mã template. Ví dụ TICKET_PURCHASED.';
COMMENT ON COLUMN notification_templates.channel IS 'Kênh gửi. APP/EMAIL/SMS/ZALO_OA.';
COMMENT ON COLUMN notification_templates.subject IS 'Tiêu đề. Dùng cho email/push.';
COMMENT ON COLUMN notification_templates.body IS 'Nội dung mẫu. Render thông báo.';
COMMENT ON COLUMN notification_templates.is_active IS 'Trạng thái bật/tắt. Cho phép ngừng template lỗi.';
COMMENT ON COLUMN notification_templates.created_at IS 'Thời điểm tạo. Audit.';
COMMENT ON COLUMN notification_templates.updated_at IS 'Thời điểm cập nhật. Audit.';
COMMENT ON TABLE notification_logs IS 'Lưu lịch sử gửi thông báo và trạng thái retry/thất bại.';
COMMENT ON COLUMN notification_logs.id IS 'Định danh log. Khóa chính.';
COMMENT ON COLUMN notification_logs.template_id IS 'Template dùng. Truy vết nội dung.';
COMMENT ON COLUMN notification_logs.user_id IS 'Người nhận. Liên kết tài khoản.';
COMMENT ON COLUMN notification_logs.concert_id IS 'Concert liên quan. Nhắc lịch/event.';
COMMENT ON COLUMN notification_logs.ticket_id IS 'Vé liên quan. Email e-ticket.';
COMMENT ON COLUMN notification_logs.channel IS 'Kênh gửi. APP/EMAIL/SMS/ZALO_OA.';
COMMENT ON COLUMN notification_logs.destination IS 'Địa chỉ nhận. Email, token app, phone.';
COMMENT ON COLUMN notification_logs.status IS 'Trạng thái gửi. PENDING/SENT/FAILED/RETRYING.';
COMMENT ON COLUMN notification_logs.provider_message_id IS 'Mã từ provider. Đối soát bên thứ ba.';
COMMENT ON COLUMN notification_logs.error_message IS 'Lỗi gửi. Retry/DLQ/debug.';
COMMENT ON COLUMN notification_logs.retry_count IS 'Số lần retry. Điều khiển retry policy.';
COMMENT ON COLUMN notification_logs.scheduled_at IS 'Lịch gửi. Nhắc trước 24 giờ.';
COMMENT ON COLUMN notification_logs.sent_at IS 'Thời điểm gửi thành công. Audit SLA.';
COMMENT ON COLUMN notification_logs.created_at IS 'Thời điểm tạo. Audit.';
COMMENT ON TABLE artist_bio_jobs IS 'Lưu job xử lý PDF/Press Kit để AI sinh artist bio.';
COMMENT ON COLUMN artist_bio_jobs.id IS 'Định danh job. Khóa chính.';
COMMENT ON COLUMN artist_bio_jobs.concert_id IS 'Concert cần bio. Gắn kết quả vào concert.';
COMMENT ON COLUMN artist_bio_jobs.uploaded_by IS 'Người upload. Audit ban tổ chức.';
COMMENT ON COLUMN artist_bio_jobs.source_file_url IS 'Đường dẫn file. Worker tải file xử lý.';
COMMENT ON COLUMN artist_bio_jobs.file_name IS 'Tên file gốc. Hiển thị admin/debug.';
COMMENT ON COLUMN artist_bio_jobs.file_size_bytes IS 'Kích thước file. Validate giới hạn upload.';
COMMENT ON COLUMN artist_bio_jobs.status IS 'Trạng thái job. PENDING/PROCESSING/DONE/FAILED.';
COMMENT ON COLUMN artist_bio_jobs.error_message IS 'Lỗi xử lý. Hiển thị retry/fallback.';
COMMENT ON COLUMN artist_bio_jobs.created_at IS 'Thời điểm tạo. Lập lịch worker.';
COMMENT ON COLUMN artist_bio_jobs.updated_at IS 'Thời điểm cập nhật. Theo dõi tiến trình.';
COMMENT ON COLUMN artist_bio_jobs.completed_at IS 'Thời điểm hoàn tất. Đo thời gian xử lý.';
COMMENT ON TABLE artist_bios IS 'Lưu nội dung bio do AI sinh ra hoặc được ghi đè từ job mới.';
COMMENT ON COLUMN artist_bios.id IS 'Định danh bio. Khóa chính.';
COMMENT ON COLUMN artist_bios.concert_id IS 'Concert sở hữu bio. Hiển thị trang chi tiết.';
COMMENT ON COLUMN artist_bios.job_id IS 'Job sinh ra bio. Truy vết nguồn.';
COMMENT ON COLUMN artist_bios.bio_text IS 'Nội dung bio. Hiển thị cho khán giả.';
COMMENT ON COLUMN artist_bios.language IS 'Ngôn ngữ. Hỗ trợ đa ngôn ngữ.';
COMMENT ON COLUMN artist_bios.is_active IS 'Bio đang dùng. Cho phép giữ lịch sử bio cũ.';
COMMENT ON COLUMN artist_bios.created_at IS 'Thời điểm tạo. Audit.';
COMMENT ON COLUMN artist_bios.updated_at IS 'Thời điểm cập nhật. Audit.';
COMMENT ON TABLE guest_import_jobs IS 'Lưu job import CSV/Google Sheets danh sách khách mời VIP.';
COMMENT ON COLUMN guest_import_jobs.id IS 'Định danh job. Khóa chính.';
COMMENT ON COLUMN guest_import_jobs.concert_id IS 'Concert import. Phạm vi guest list.';
COMMENT ON COLUMN guest_import_jobs.uploaded_by IS 'Người upload/trigger. Audit.';
COMMENT ON COLUMN guest_import_jobs.source_file_url IS 'Đường dẫn file CSV. Worker đọc file.';
COMMENT ON COLUMN guest_import_jobs.source_file_name IS 'Tên file. Hiển thị admin.';
COMMENT ON COLUMN guest_import_jobs.status IS 'Trạng thái import. PENDING/PROCESSING/DONE/FAILED/PARTIAL.';
COMMENT ON COLUMN guest_import_jobs.total_rows IS 'Tổng dòng. Đối chiếu kết quả.';
COMMENT ON COLUMN guest_import_jobs.success_rows IS 'Dòng hợp lệ. Thống kê import.';
COMMENT ON COLUMN guest_import_jobs.error_rows IS 'Dòng lỗi. Điều tra lỗi file.';
COMMENT ON COLUMN guest_import_jobs.started_at IS 'Thời điểm bắt đầu. Đo thời gian xử lý.';
COMMENT ON COLUMN guest_import_jobs.completed_at IS 'Thời điểm hoàn tất. Audit.';
COMMENT ON COLUMN guest_import_jobs.error_message IS 'Lỗi cấp job. Hiển thị admin.';
COMMENT ON COLUMN guest_import_jobs.created_at IS 'Thời điểm tạo. Audit.';
COMMENT ON COLUMN guest_import_jobs.updated_at IS 'Thời điểm cập nhật. Audit.';
COMMENT ON TABLE guest_import_errors IS 'Lưu lỗi theo từng dòng CSV để import không làm gián đoạn hệ thống.';
COMMENT ON COLUMN guest_import_errors.id IS 'Định danh lỗi. Khóa chính.';
COMMENT ON COLUMN guest_import_errors.job_id IS 'Job import cha. Gắn lỗi với file import.';
COMMENT ON COLUMN guest_import_errors.row_number IS 'Số dòng lỗi. Admin sửa đúng dòng.';
COMMENT ON COLUMN guest_import_errors.raw_data IS 'Dữ liệu dòng lỗi. Debug dữ liệu CSV.';
COMMENT ON COLUMN guest_import_errors.error_message IS 'Mô tả lỗi. Giải thích vì sao dòng bị skip.';
COMMENT ON COLUMN guest_import_errors.created_at IS 'Thời điểm ghi lỗi. Audit.';
COMMENT ON TABLE guest_list IS 'Lưu danh sách khách mời VIP sau khi import CSV và trạng thái check-in guest.';
COMMENT ON COLUMN guest_list.id IS 'Định danh khách mời. Khóa chính.';
COMMENT ON COLUMN guest_list.concert_id IS 'Concert được mời. Phạm vi guest.';
COMMENT ON COLUMN guest_list.seat_zone_id IS 'Khu VIP/guest. Điều hướng cổng/khu.';
COMMENT ON COLUMN guest_list.full_name IS 'Tên khách mời. Tra cứu tại cổng VIP.';
COMMENT ON COLUMN guest_list.phone IS 'Số điện thoại. Deduplicate theo concert.';
COMMENT ON COLUMN guest_list.email IS 'Email khách mời. Liên hệ/thông báo nếu có.';
COMMENT ON COLUMN guest_list.sponsor_name IS 'Nhãn hàng tài trợ. Phân loại nguồn khách mời.';
COMMENT ON COLUMN guest_list.status IS 'Trạng thái guest. INVITED/CHECKED_IN/CANCELLED.';
COMMENT ON COLUMN guest_list.checked_in_at IS 'Thời điểm check-in VIP. Chống check-in lặp.';
COMMENT ON COLUMN guest_list.checked_in_by IS 'Nhân sự xác nhận. Audit.';
COMMENT ON COLUMN guest_list.created_at IS 'Thời điểm tạo. Audit.';
COMMENT ON COLUMN guest_list.updated_at IS 'Thời điểm cập nhật. Audit.';
COMMENT ON TABLE audit_logs IS 'Ghi lại thao tác quan trọng để truy vết bảo mật và debug.';
COMMENT ON COLUMN audit_logs.id IS 'Định danh audit log. Khóa chính.';
COMMENT ON COLUMN audit_logs.actor_user_id IS 'Người thực hiện. Truy trách nhiệm.';
COMMENT ON COLUMN audit_logs.action IS 'Hành động. CREATE_CONCERT, UPDATE_TICKET_TYPE, CHECKIN...';
COMMENT ON COLUMN audit_logs.entity_type IS 'Loại entity. concerts/ticket_types/orders/...';
COMMENT ON COLUMN audit_logs.entity_id IS 'ID entity bị tác động. Liên kết bản ghi nghiệp vụ.';
COMMENT ON COLUMN audit_logs.before_data IS 'Dữ liệu trước thay đổi. Audit diff.';
COMMENT ON COLUMN audit_logs.after_data IS 'Dữ liệu sau thay đổi. Audit diff.';
COMMENT ON COLUMN audit_logs.ip_address IS 'IP request. Điều tra bảo mật.';
COMMENT ON COLUMN audit_logs.user_agent IS 'User agent. Điều tra thiết bị/client.';
COMMENT ON COLUMN audit_logs.created_at IS 'Thời điểm ghi log. Dòng thời gian audit.';

COMMIT;
