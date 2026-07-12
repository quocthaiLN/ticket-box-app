-- seed.sql
-- Idempotent MVP demo data for TicketBox.

BEGIN;

INSERT INTO users (id, email, password_hash, full_name, phone, role, status)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'audience@ticketbox.test', '$2b$10$demo-audience', 'Demo Audience', '+84900000001', 'AUDIENCE', 'ACTIVE'),
  ('00000000-0000-0000-0000-000000000002', 'organizer@ticketbox.test', '$2b$10$demo-organizer', 'Demo Organizer', '+84900000002', 'ORGANIZER', 'ACTIVE'),
  ('00000000-0000-0000-0000-000000000003', 'checker@ticketbox.test', '$2b$10$demo-checker', 'Demo Checker', '+84900000003', 'CHECKER', 'ACTIVE'),
  ('00000000-0000-0000-0000-000000000004', 'admin@ticketbox.test', '$2b$10$demo-admin', 'Demo Admin', '+84900000004', 'ADMIN', 'ACTIVE')
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  password_hash = EXCLUDED.password_hash,
  full_name = EXCLUDED.full_name,
  phone = EXCLUDED.phone,
  role = EXCLUDED.role,
  status = EXCLUDED.status;

INSERT INTO venues (id, name, address, city, capacity, map_url)
VALUES
  ('00000000-0000-0000-0000-000000000101', 'Sân vận động Quốc gia Mỹ Đình', 'Đường Lê Đức Thọ, Nam Từ Liêm', 'Hà Nội', 40000, 'https://maps.example.com/my-dinh'),
  ('00000000-0000-0000-0000-000000000102', 'Nhà thi đấu Phú Thọ', '221 Lý Thường Kiệt, Quận 11', 'TP. Hồ Chí Minh', 5000, 'https://maps.example.com/phu-tho'),
  ('00000000-0000-0000-0000-000000000103', 'SECC Hall A', '799 Nguyễn Văn Linh, Quận 7', 'TP. Hồ Chí Minh', 12000, 'https://maps.example.com/secc'),
  ('00000000-0000-0000-0000-000000000104', 'Sân vận động Quân khu 7', '202 Hoàng Văn Thụ, Tân Bình', 'TP. Hồ Chí Minh', 25000, 'https://maps.example.com/qk7')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  address = EXCLUDED.address,
  city = EXCLUDED.city,
  capacity = EXCLUDED.capacity,
  map_url = EXCLUDED.map_url;

INSERT INTO concerts (
  id, venue_id, organizer_id, title, slug, description, artist_name, artist_bio,
  starts_at, ends_at, status, cover_image_url, seat_map_url
)
VALUES
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000002', 'Anh Trai Say Hi', 'anh-trai-say-hi', 'Concert demo cho hệ thống TicketBox.', 'Various Artists', 'Bio ngắn dùng cho demo catalog Anh Trai Say Hi.', '2026-07-25 19:30:00', '2026-07-25 23:00:00', 'PUBLISHED', 'https://cdn.example.com/ticketbox/anh-trai-say-hi.jpg', 'https://cdn.example.com/ticketbox/seat-maps/anh-trai-say-hi.svg'),
  ('00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000002', 'Anh Trai Vượt Ngàn Chông Gai', 'anh-trai-vuot-ngan-chong-gai', 'Concert demo cho hệ thống TicketBox.', 'Various Artists', 'Bio ngắn dùng cho demo Anh Trai Vượt Ngàn Chông Gai.', '2026-08-08 19:30:00', '2026-08-08 23:00:00', 'PUBLISHED', 'https://cdn.example.com/ticketbox/anh-trai-vuot-ngan-chong-gai.jpg', 'https://cdn.example.com/ticketbox/seat-maps/anh-trai-vuot-ngan-chong-gai.svg'),
  ('00000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000002', 'Em Xinh Say Hi', 'em-xinh-say-hi', 'Concert demo cho hệ thống TicketBox.', 'Various Artists', 'Bio ngắn dùng cho demo Em Xinh Say Hi.', '2026-09-12 19:30:00', '2026-09-12 23:00:00', 'PUBLISHED', 'https://cdn.example.com/ticketbox/em-xinh-say-hi.jpg', 'https://cdn.example.com/ticketbox/seat-maps/em-xinh-say-hi.svg'),
  ('00000000-0000-0000-0000-000000000204', '00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000000002', 'Chị Đẹp Đạp Gió Rẽ Sóng', 'chi-dep-dap-gio-re-song', 'Concert demo cho hệ thống TicketBox.', 'Various Artists', 'Bio ngắn dùng cho demo Chị Đẹp Đạp Gió Rẽ Sóng.', '2026-10-03 19:30:00', '2026-10-03 23:00:00', 'PUBLISHED', 'https://cdn.example.com/ticketbox/chi-dep-dap-gio-re-song.jpg', 'https://cdn.example.com/ticketbox/seat-maps/chi-dep-dap-gio-re-song.svg')
ON CONFLICT (id) DO UPDATE SET
  venue_id = EXCLUDED.venue_id,
  organizer_id = EXCLUDED.organizer_id,
  title = EXCLUDED.title,
  slug = EXCLUDED.slug,
  description = EXCLUDED.description,
  artist_name = EXCLUDED.artist_name,
  artist_bio = EXCLUDED.artist_bio,
  starts_at = EXCLUDED.starts_at,
  ends_at = EXCLUDED.ends_at,
  status = EXCLUDED.status,
  cover_image_url = EXCLUDED.cover_image_url,
  seat_map_url = EXCLUDED.seat_map_url;

WITH zone_seed(id, concert_id, code, name, description, capacity, svg_path, sort_order) AS (
  VALUES
    ('00000000-0000-0000-0000-000000000301'::uuid, '00000000-0000-0000-0000-000000000201'::uuid, 'SVIP', 'SVIP', 'Khu gần sân khấu.', 20, 'M120 10 H180 V70 H120 Z', 1),
    ('00000000-0000-0000-0000-000000000302'::uuid, '00000000-0000-0000-0000-000000000201'::uuid, 'VIP', 'VIP', 'Khu ưu tiên.', 30, 'M190 10 H260 V90 H190 Z', 2),
    ('00000000-0000-0000-0000-000000000303'::uuid, '00000000-0000-0000-0000-000000000201'::uuid, 'CAT1', 'CAT1', 'Khu ghế trung tâm.', 40, 'M270 10 H360 V130 H270 Z', 3),
    ('00000000-0000-0000-0000-000000000304'::uuid, '00000000-0000-0000-0000-000000000201'::uuid, 'CAT2', 'CAT2', 'Khu ghế phổ thông.', 100, 'M370 10 H480 V160 H370 Z', 4),
    ('00000000-0000-0000-0000-000000000305'::uuid, '00000000-0000-0000-0000-000000000201'::uuid, 'GA', 'General Admission', 'Khu đứng tự do.', 200, 'M10 10 H110 V110 H10 Z', 5),

    ('00000000-0000-0000-0000-000000000306'::uuid, '00000000-0000-0000-0000-000000000202'::uuid, 'SVIP', 'SVIP', 'Khu gần sân khấu.', 250, 'M120 10 H180 V70 H120 Z', 1),
    ('00000000-0000-0000-0000-000000000307'::uuid, '00000000-0000-0000-0000-000000000202'::uuid, 'VIP', 'VIP', 'Khu ưu tiên.', 600, 'M190 10 H260 V90 H190 Z', 2),
    ('00000000-0000-0000-0000-000000000308'::uuid, '00000000-0000-0000-0000-000000000202'::uuid, 'CAT1', 'CAT1', 'Khu ghế trung tâm.', 1200, 'M270 10 H360 V130 H270 Z', 3),
    ('00000000-0000-0000-0000-000000000309'::uuid, '00000000-0000-0000-0000-000000000202'::uuid, 'CAT2', 'CAT2', 'Khu ghế phổ thông.', 1500, 'M370 10 H480 V160 H370 Z', 4),
    ('00000000-0000-0000-0000-000000000310'::uuid, '00000000-0000-0000-0000-000000000202'::uuid, 'GA', 'General Admission', 'Khu đứng tự do.', 1200, 'M10 10 H110 V110 H10 Z', 5),

    ('00000000-0000-0000-0000-000000000311'::uuid, '00000000-0000-0000-0000-000000000203'::uuid, 'SVIP', 'SVIP', 'Khu gần sân khấu.', 500, 'M120 10 H180 V70 H120 Z', 1),
    ('00000000-0000-0000-0000-000000000312'::uuid, '00000000-0000-0000-0000-000000000203'::uuid, 'VIP', 'VIP', 'Khu ưu tiên.', 1200, 'M190 10 H260 V90 H190 Z', 2),
    ('00000000-0000-0000-0000-000000000313'::uuid, '00000000-0000-0000-0000-000000000203'::uuid, 'CAT1', 'CAT1', 'Khu ghế trung tâm.', 3000, 'M270 10 H360 V130 H270 Z', 3),
    ('00000000-0000-0000-0000-000000000314'::uuid, '00000000-0000-0000-0000-000000000203'::uuid, 'CAT2', 'CAT2', 'Khu ghế phổ thông.', 3300, 'M370 10 H480 V160 H370 Z', 4),
    ('00000000-0000-0000-0000-000000000315'::uuid, '00000000-0000-0000-0000-000000000203'::uuid, 'GA', 'General Admission', 'Khu đứng tự do.', 4000, 'M10 10 H110 V110 H10 Z', 5),

    ('00000000-0000-0000-0000-000000000316'::uuid, '00000000-0000-0000-0000-000000000204'::uuid, 'SVIP', 'SVIP', 'Khu gần sân khấu.', 400, 'M120 10 H180 V70 H120 Z', 1),
    ('00000000-0000-0000-0000-000000000317'::uuid, '00000000-0000-0000-0000-000000000204'::uuid, 'VIP', 'VIP', 'Khu ưu tiên.', 1600, 'M190 10 H260 V90 H190 Z', 2),
    ('00000000-0000-0000-0000-000000000318'::uuid, '00000000-0000-0000-0000-000000000204'::uuid, 'CAT1', 'CAT1', 'Khu ghế trung tâm.', 6000, 'M270 10 H360 V130 H270 Z', 3),
    ('00000000-0000-0000-0000-000000000319'::uuid, '00000000-0000-0000-0000-000000000204'::uuid, 'CAT2', 'CAT2', 'Khu ghế phổ thông.', 8000, 'M370 10 H480 V160 H370 Z', 4),
    ('00000000-0000-0000-0000-000000000320'::uuid, '00000000-0000-0000-0000-000000000204'::uuid, 'GA', 'General Admission', 'Khu đứng tự do.', 9000, 'M10 10 H110 V110 H10 Z', 5)
)
INSERT INTO seat_zones (id, concert_id, code, name, description, capacity, svg_path, sort_order)
SELECT * FROM zone_seed
ON CONFLICT (id) DO UPDATE SET
  concert_id = EXCLUDED.concert_id,
  code = EXCLUDED.code,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  capacity = EXCLUDED.capacity,
  svg_path = EXCLUDED.svg_path,
  sort_order = EXCLUDED.sort_order;

WITH gate_seed(id, concert_id, code, name, description, sort_order) AS (
  SELECT
    ('00000000-0000-0000-0000-' || lpad((400 + ((right(c.id::text, 3)::int - 201) * 5) + z.sort_order)::text, 12, '0'))::uuid,
    c.id,
    z.code || '_GATE',
    'Cổng ' || z.code,
    'Cổng dành cho khu ' || z.code || '.',
    z.sort_order
  FROM concerts c
  JOIN seat_zones z ON z.concert_id = c.id
  WHERE c.id IN (
    '00000000-0000-0000-0000-000000000201',
    '00000000-0000-0000-0000-000000000202',
    '00000000-0000-0000-0000-000000000203',
    '00000000-0000-0000-0000-000000000204'
  )
)
INSERT INTO checkin_gates (id, concert_id, code, name, description, is_active, sort_order)
SELECT id, concert_id, code, name, description, TRUE, sort_order
FROM gate_seed
ON CONFLICT (id) DO UPDATE SET
  concert_id = EXCLUDED.concert_id,
  code = EXCLUDED.code,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order;

INSERT INTO checkin_gate_zones (gate_id, seat_zone_id, concert_id)
SELECT g.id, z.id, z.concert_id
FROM checkin_gates g
JOIN seat_zones z ON z.concert_id = g.concert_id AND g.code = z.code || '_GATE'
ON CONFLICT (gate_id, seat_zone_id) DO UPDATE SET
  concert_id = EXCLUDED.concert_id;

WITH ticket_type_seed(id, concert_id, zone_code, name, description, price, total_quantity, max_per_user, sale_start_at, sale_end_at) AS (
  VALUES
    ('00000000-0000-0000-0000-000000000501'::uuid, '00000000-0000-0000-0000-000000000201'::uuid, 'SVIP', 'SVIP Standard', 'Vé SVIP số lượng giới hạn.', 3500000.00, 200, 2, '2026-06-01 10:00:00'::timestamp, '2026-07-20 23:59:59'::timestamp),
    ('00000000-0000-0000-0000-000000000502'::uuid, '00000000-0000-0000-0000-000000000201'::uuid, 'VIP', 'VIP Standard', 'Vé VIP.', 2500000.00, 1800, 2, '2026-06-01 10:00:00'::timestamp, '2026-07-20 23:59:59'::timestamp),
    ('00000000-0000-0000-0000-000000000503'::uuid, '00000000-0000-0000-0000-000000000201'::uuid, 'CAT1', 'CAT1 Standard', 'Vé CAT1.', 1800000.00, 6000, 4, '2026-06-01 10:00:00'::timestamp, '2026-07-20 23:59:59'::timestamp),
    ('00000000-0000-0000-0000-000000000504'::uuid, '00000000-0000-0000-0000-000000000201'::uuid, 'CAT2', 'CAT2 Standard', 'Vé CAT2.', 1200000.00, 10000, 4, '2026-06-01 10:00:00'::timestamp, '2026-07-20 23:59:59'::timestamp),
    ('00000000-0000-0000-0000-000000000505'::uuid, '00000000-0000-0000-0000-000000000201'::uuid, 'GA', 'GA Standard', 'Vé đứng GA.', 900000.00, 14000, 4, '2026-06-01 10:00:00'::timestamp, '2026-07-20 23:59:59'::timestamp),

    ('00000000-0000-0000-0000-000000000506'::uuid, '00000000-0000-0000-0000-000000000202'::uuid, 'SVIP', 'SVIP Standard', 'Vé SVIP.', 3000000.00, 250, 2, '2026-06-15 10:00:00'::timestamp, '2026-08-03 23:59:59'::timestamp),
    ('00000000-0000-0000-0000-000000000507'::uuid, '00000000-0000-0000-0000-000000000202'::uuid, 'VIP', 'VIP Standard', 'Vé VIP.', 2200000.00, 600, 2, '2026-06-15 10:00:00'::timestamp, '2026-08-03 23:59:59'::timestamp),
    ('00000000-0000-0000-0000-000000000508'::uuid, '00000000-0000-0000-0000-000000000202'::uuid, 'CAT1', 'CAT1 Standard', 'Vé CAT1.', 1600000.00, 1200, 4, '2026-06-15 10:00:00'::timestamp, '2026-08-03 23:59:59'::timestamp),
    ('00000000-0000-0000-0000-000000000509'::uuid, '00000000-0000-0000-0000-000000000202'::uuid, 'CAT2', 'CAT2 Standard', 'Vé CAT2.', 1000000.00, 1500, 4, '2026-06-15 10:00:00'::timestamp, '2026-08-03 23:59:59'::timestamp),
    ('00000000-0000-0000-0000-000000000510'::uuid, '00000000-0000-0000-0000-000000000202'::uuid, 'GA', 'GA Standard', 'Vé đứng GA.', 750000.00, 1200, 4, '2026-06-15 10:00:00'::timestamp, '2026-08-03 23:59:59'::timestamp),

    ('00000000-0000-0000-0000-000000000511'::uuid, '00000000-0000-0000-0000-000000000203'::uuid, 'SVIP', 'SVIP Standard', 'Vé SVIP.', 3200000.00, 500, 2, '2026-07-01 10:00:00'::timestamp, '2026-09-07 23:59:59'::timestamp),
    ('00000000-0000-0000-0000-000000000512'::uuid, '00000000-0000-0000-0000-000000000203'::uuid, 'VIP', 'VIP Standard', 'Vé VIP.', 2300000.00, 1200, 2, '2026-07-01 10:00:00'::timestamp, '2026-09-07 23:59:59'::timestamp),
    ('00000000-0000-0000-0000-000000000513'::uuid, '00000000-0000-0000-0000-000000000203'::uuid, 'CAT1', 'CAT1 Standard', 'Vé CAT1.', 1700000.00, 3000, 4, '2026-07-01 10:00:00'::timestamp, '2026-09-07 23:59:59'::timestamp),
    ('00000000-0000-0000-0000-000000000514'::uuid, '00000000-0000-0000-0000-000000000203'::uuid, 'CAT2', 'CAT2 Standard', 'Vé CAT2.', 1100000.00, 3300, 4, '2026-07-01 10:00:00'::timestamp, '2026-09-07 23:59:59'::timestamp),
    ('00000000-0000-0000-0000-000000000515'::uuid, '00000000-0000-0000-0000-000000000203'::uuid, 'GA', 'GA Standard', 'Vé đứng GA.', 800000.00, 4000, 4, '2026-07-01 10:00:00'::timestamp, '2026-09-07 23:59:59'::timestamp),

    ('00000000-0000-0000-0000-000000000516'::uuid, '00000000-0000-0000-0000-000000000204'::uuid, 'SVIP', 'SVIP Standard', 'Vé SVIP.', 3400000.00, 400, 2, '2026-08-01 10:00:00'::timestamp, '2026-09-28 23:59:59'::timestamp),
    ('00000000-0000-0000-0000-000000000517'::uuid, '00000000-0000-0000-0000-000000000204'::uuid, 'VIP', 'VIP Standard', 'Vé VIP.', 2400000.00, 1600, 2, '2026-08-01 10:00:00'::timestamp, '2026-09-28 23:59:59'::timestamp),
    ('00000000-0000-0000-0000-000000000518'::uuid, '00000000-0000-0000-0000-000000000204'::uuid, 'CAT1', 'CAT1 Standard', 'Vé CAT1.', 1750000.00, 6000, 4, '2026-08-01 10:00:00'::timestamp, '2026-09-28 23:59:59'::timestamp),
    ('00000000-0000-0000-0000-000000000519'::uuid, '00000000-0000-0000-0000-000000000204'::uuid, 'CAT2', 'CAT2 Standard', 'Vé CAT2.', 1150000.00, 8000, 4, '2026-08-01 10:00:00'::timestamp, '2026-09-28 23:59:59'::timestamp),
    ('00000000-0000-0000-0000-000000000520'::uuid, '00000000-0000-0000-0000-000000000204'::uuid, 'GA', 'GA Standard', 'Vé đứng GA.', 850000.00, 9000, 4, '2026-08-01 10:00:00'::timestamp, '2026-09-28 23:59:59'::timestamp)
)
INSERT INTO ticket_types (
  id, concert_id, seat_zone_id, name, description, price, currency,
  total_quantity, held_quantity, sold_quantity, max_per_user, sale_start_at, sale_end_at, status
)
SELECT
  t.id, t.concert_id, z.id, t.name, t.description, t.price, 'VND',
  t.total_quantity, 0, CASE WHEN t.zone_code = 'VIP' THEN 1 ELSE 0 END,
  t.max_per_user, t.sale_start_at, t.sale_end_at, 'ON_SALE'
FROM ticket_type_seed t
JOIN seat_zones z ON z.concert_id = t.concert_id AND z.code = t.zone_code
ON CONFLICT (id) DO UPDATE SET
  concert_id = EXCLUDED.concert_id,
  seat_zone_id = EXCLUDED.seat_zone_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  currency = EXCLUDED.currency,
  total_quantity = EXCLUDED.total_quantity,
  held_quantity = EXCLUDED.held_quantity,
  sold_quantity = EXCLUDED.sold_quantity,
  max_per_user = EXCLUDED.max_per_user,
  sale_start_at = EXCLUDED.sale_start_at,
  sale_end_at = EXCLUDED.sale_end_at,
  status = EXCLUDED.status;

WITH order_seed(order_id, order_item_id, payment_id, ticket_id, concert_id, ticket_type_id, amount, idempotency_key) AS (
  VALUES
    ('00000000-0000-0000-0000-000000000601'::uuid, '00000000-0000-0000-0000-000000000611'::uuid, '00000000-0000-0000-0000-000000000621'::uuid, '00000000-0000-0000-0000-000000000631'::uuid, '00000000-0000-0000-0000-000000000201'::uuid, '00000000-0000-0000-0000-000000000502'::uuid, 2500000.00, 'seed-order-anh-trai-say-hi'),
    ('00000000-0000-0000-0000-000000000602'::uuid, '00000000-0000-0000-0000-000000000612'::uuid, '00000000-0000-0000-0000-000000000622'::uuid, '00000000-0000-0000-0000-000000000632'::uuid, '00000000-0000-0000-0000-000000000202'::uuid, '00000000-0000-0000-0000-000000000507'::uuid, 2200000.00, 'seed-order-anh-trai-vuot-ngan-chong-gai'),
    ('00000000-0000-0000-0000-000000000603'::uuid, '00000000-0000-0000-0000-000000000613'::uuid, '00000000-0000-0000-0000-000000000623'::uuid, '00000000-0000-0000-0000-000000000633'::uuid, '00000000-0000-0000-0000-000000000203'::uuid, '00000000-0000-0000-0000-000000000512'::uuid, 2300000.00, 'seed-order-em-xinh-say-hi'),
    ('00000000-0000-0000-0000-000000000604'::uuid, '00000000-0000-0000-0000-000000000614'::uuid, '00000000-0000-0000-0000-000000000624'::uuid, '00000000-0000-0000-0000-000000000634'::uuid, '00000000-0000-0000-0000-000000000204'::uuid, '00000000-0000-0000-0000-000000000517'::uuid, 2400000.00, 'seed-order-chi-dep-dap-gio-re-song')
)
INSERT INTO orders (id, user_id, concert_id, idempotency_key, status, total_amount, currency, confirmed_at)
SELECT order_id, '00000000-0000-0000-0000-000000000001', concert_id, idempotency_key, 'CONFIRMED', amount, 'VND', '2026-06-02 10:00:00'::timestamp
FROM order_seed
ON CONFLICT (id) DO UPDATE SET
  user_id = EXCLUDED.user_id,
  concert_id = EXCLUDED.concert_id,
  idempotency_key = EXCLUDED.idempotency_key,
  status = EXCLUDED.status,
  total_amount = EXCLUDED.total_amount,
  currency = EXCLUDED.currency,
  confirmed_at = EXCLUDED.confirmed_at;

WITH order_seed(order_id, order_item_id, ticket_type_id, amount) AS (
  VALUES
    ('00000000-0000-0000-0000-000000000601'::uuid, '00000000-0000-0000-0000-000000000611'::uuid, '00000000-0000-0000-0000-000000000502'::uuid, 2500000.00),
    ('00000000-0000-0000-0000-000000000602'::uuid, '00000000-0000-0000-0000-000000000612'::uuid, '00000000-0000-0000-0000-000000000507'::uuid, 2200000.00),
    ('00000000-0000-0000-0000-000000000603'::uuid, '00000000-0000-0000-0000-000000000613'::uuid, '00000000-0000-0000-0000-000000000512'::uuid, 2300000.00),
    ('00000000-0000-0000-0000-000000000604'::uuid, '00000000-0000-0000-0000-000000000614'::uuid, '00000000-0000-0000-0000-000000000517'::uuid, 2400000.00)
)
INSERT INTO order_items (id, order_id, ticket_type_id, quantity, unit_price, line_total)
SELECT order_item_id, order_id, ticket_type_id, 1, amount, amount
FROM order_seed
ON CONFLICT (id) DO UPDATE SET
  order_id = EXCLUDED.order_id,
  ticket_type_id = EXCLUDED.ticket_type_id,
  quantity = EXCLUDED.quantity,
  unit_price = EXCLUDED.unit_price,
  line_total = EXCLUDED.line_total;

WITH payment_seed(id, order_id, amount, idem, tx) AS (
  VALUES
    ('00000000-0000-0000-0000-000000000621'::uuid, '00000000-0000-0000-0000-000000000601'::uuid, 2500000.00, 'seed-payment-anh-trai-say-hi', 'VNPAY-SEED-001'),
    ('00000000-0000-0000-0000-000000000622'::uuid, '00000000-0000-0000-0000-000000000602'::uuid, 2200000.00, 'seed-payment-anh-trai-vuot-ngan-chong-gai', 'VNPAY-SEED-002'),
    ('00000000-0000-0000-0000-000000000623'::uuid, '00000000-0000-0000-0000-000000000603'::uuid, 2300000.00, 'seed-payment-em-xinh-say-hi', 'MOMO-SEED-003'),
    ('00000000-0000-0000-0000-000000000624'::uuid, '00000000-0000-0000-0000-000000000604'::uuid, 2400000.00, 'seed-payment-chi-dep-dap-gio-re-song', 'MOMO-SEED-004')
)
INSERT INTO payments (
  id, order_id, provider, provider_transaction_id, idempotency_key,
  amount, currency, status, checkout_url, provider_payload, webhook_payload,
  webhook_received_at, webhook_signature_valid, paid_at
)
SELECT
  id, order_id,
  CASE WHEN tx LIKE 'VNPAY%' THEN 'VNPAY'::payment_provider ELSE 'MOMO'::payment_provider END,
  tx, idem, amount, 'VND', 'SUCCEEDED',
  'https://sandbox-payments.example.com/' || tx,
  jsonb_build_object('seed', true),
  jsonb_build_object('transaction_id', tx, 'status', 'success'),
  '2026-06-02 10:03:00'::timestamp,
  TRUE,
  '2026-06-02 10:03:00'::timestamp
FROM payment_seed
ON CONFLICT (id) DO UPDATE SET
  order_id = EXCLUDED.order_id,
  provider = EXCLUDED.provider,
  provider_transaction_id = EXCLUDED.provider_transaction_id,
  idempotency_key = EXCLUDED.idempotency_key,
  amount = EXCLUDED.amount,
  currency = EXCLUDED.currency,
  status = EXCLUDED.status,
  checkout_url = EXCLUDED.checkout_url,
  provider_payload = EXCLUDED.provider_payload,
  webhook_payload = EXCLUDED.webhook_payload,
  webhook_received_at = EXCLUDED.webhook_received_at,
  webhook_signature_valid = EXCLUDED.webhook_signature_valid,
  paid_at = EXCLUDED.paid_at;

WITH ticket_seed(id, order_id, order_item_id, ticket_type_id, qr_hash) AS (
  VALUES
    ('00000000-0000-0000-0000-000000000631'::uuid, '00000000-0000-0000-0000-000000000601'::uuid, '00000000-0000-0000-0000-000000000611'::uuid, '00000000-0000-0000-0000-000000000502'::uuid, 'qr-seed-anh-trai-say-hi-vip-001'),
    ('00000000-0000-0000-0000-000000000632'::uuid, '00000000-0000-0000-0000-000000000602'::uuid, '00000000-0000-0000-0000-000000000612'::uuid, '00000000-0000-0000-0000-000000000507'::uuid, 'qr-seed-anh-trai-vuot-ngan-chong-gai-vip-001'),
    ('00000000-0000-0000-0000-000000000633'::uuid, '00000000-0000-0000-0000-000000000603'::uuid, '00000000-0000-0000-0000-000000000613'::uuid, '00000000-0000-0000-0000-000000000512'::uuid, 'qr-seed-em-xinh-say-hi-vip-001'),
    ('00000000-0000-0000-0000-000000000634'::uuid, '00000000-0000-0000-0000-000000000604'::uuid, '00000000-0000-0000-0000-000000000614'::uuid, '00000000-0000-0000-0000-000000000517'::uuid, 'qr-seed-chi-dep-dap-gio-re-song-vip-001')
)
INSERT INTO tickets (
  id, order_id, order_item_id, user_id, concert_id, ticket_type_id, seat_zone_id,
  qr_token_hash, qr_payload, qr_signature, status, issued_at
)
SELECT
  ts.id, ts.order_id, ts.order_item_id, o.user_id, o.concert_id, ts.ticket_type_id, tt.seat_zone_id,
  ts.qr_hash, jsonb_build_object('ticket_id', ts.id, 'qr_token_hash', ts.qr_hash),
  'demo-signature', 'ISSUED', '2026-06-02 10:05:00'::timestamp
FROM ticket_seed ts
JOIN orders o ON o.id = ts.order_id
JOIN ticket_types tt ON tt.id = ts.ticket_type_id
ON CONFLICT (id) DO UPDATE SET
  order_id = EXCLUDED.order_id,
  order_item_id = EXCLUDED.order_item_id,
  user_id = EXCLUDED.user_id,
  concert_id = EXCLUDED.concert_id,
  ticket_type_id = EXCLUDED.ticket_type_id,
  seat_zone_id = EXCLUDED.seat_zone_id,
  qr_token_hash = EXCLUDED.qr_token_hash,
  qr_payload = EXCLUDED.qr_payload,
  qr_signature = EXCLUDED.qr_signature,
  status = EXCLUDED.status,
  issued_at = EXCLUDED.issued_at;

INSERT INTO user_ticket_type_counters (user_id, ticket_type_id, held_quantity, paid_quantity)
VALUES
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000502', 0, 1),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000507', 0, 1),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000512', 0, 1),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000517', 0, 1)
ON CONFLICT (user_id, ticket_type_id) DO UPDATE SET
  held_quantity = EXCLUDED.held_quantity,
  paid_quantity = EXCLUDED.paid_quantity;

INSERT INTO checkin_devices (id, device_code, staff_id, concert_id, gate_id, name, status, last_seen_at)
SELECT
  ('00000000-0000-0000-0000-00000000064' || (row_number() OVER (ORDER BY c.id))::text)::uuid,
  'CHECKER-' || c.slug || '-VIP',
  '00000000-0000-0000-0000-000000000003',
  c.id,
  g.id,
  'Demo checker device - ' || c.title,
  'ACTIVE',
  '2026-06-02 11:00:00'::timestamp
FROM concerts c
JOIN checkin_gates g ON g.concert_id = c.id AND g.code = 'VIP_GATE'
WHERE c.id IN (
  '00000000-0000-0000-0000-000000000201',
  '00000000-0000-0000-0000-000000000202',
  '00000000-0000-0000-0000-000000000203',
  '00000000-0000-0000-0000-000000000204'
)
ON CONFLICT (id) DO UPDATE SET
  device_code = EXCLUDED.device_code,
  staff_id = EXCLUDED.staff_id,
  concert_id = EXCLUDED.concert_id,
  gate_id = EXCLUDED.gate_id,
  name = EXCLUDED.name,
  status = EXCLUDED.status,
  last_seen_at = EXCLUDED.last_seen_at;

INSERT INTO guest_import_jobs (id, concert_id, uploaded_by, file_url, status, total_rows, success_rows, error_rows, started_at, completed_at)
VALUES
  ('00000000-0000-0000-0000-000000000651', '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000002', 'https://storage.example.com/imports/anh-trai-say-hi-guests.csv', 'PARTIAL', 3, 2, 1, '2026-06-02 09:00:00', '2026-06-02 09:01:00'),
  ('00000000-0000-0000-0000-000000000652', '00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000002', 'https://storage.example.com/imports/anh-trai-vuot-ngan-chong-gai-guests.csv', 'DONE', 2, 2, 0, '2026-06-02 09:00:00', '2026-06-02 09:01:00'),
  ('00000000-0000-0000-0000-000000000653', '00000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-000000000002', 'https://storage.example.com/imports/em-xinh-say-hi-guests.csv', 'DONE', 2, 2, 0, '2026-06-02 09:00:00', '2026-06-02 09:01:00'),
  ('00000000-0000-0000-0000-000000000654', '00000000-0000-0000-0000-000000000204', '00000000-0000-0000-0000-000000000002', 'https://storage.example.com/imports/chi-dep-dap-gio-re-song-guests.csv', 'DONE', 2, 2, 0, '2026-06-02 09:00:00', '2026-06-02 09:01:00')
ON CONFLICT (id) DO UPDATE SET
  concert_id = EXCLUDED.concert_id,
  uploaded_by = EXCLUDED.uploaded_by,
  file_url = EXCLUDED.file_url,
  status = EXCLUDED.status,
  total_rows = EXCLUDED.total_rows,
  success_rows = EXCLUDED.success_rows,
  error_rows = EXCLUDED.error_rows,
  started_at = EXCLUDED.started_at,
  completed_at = EXCLUDED.completed_at;

INSERT INTO guest_list (id, concert_id, seat_zone_id, import_job_id, full_name, phone, email, code, status, note)
SELECT v.id, v.concert_id, z.id, v.import_job_id, v.full_name, v.phone, v.email, v.code, 'INVITED', 'Demo guest'
FROM (
  VALUES
    ('00000000-0000-0000-0000-000000000661'::uuid, '00000000-0000-0000-0000-000000000201'::uuid, '00000000-0000-0000-0000-000000000651'::uuid, 'VIP', 'Guest Anh Trai 1', '+84910000101', 'guest101@example.com', 'GUEST-ATSH-001'),
    ('00000000-0000-0000-0000-000000000662'::uuid, '00000000-0000-0000-0000-000000000201'::uuid, '00000000-0000-0000-0000-000000000651'::uuid, 'SVIP', 'Guest Anh Trai 2', '+84910000102', 'guest102@example.com', 'GUEST-ATSH-002'),
    ('00000000-0000-0000-0000-000000000663'::uuid, '00000000-0000-0000-0000-000000000202'::uuid, '00000000-0000-0000-0000-000000000652'::uuid, 'VIP', 'Guest Chông Gai 1', '+84910000201', 'guest201@example.com', 'GUEST-ATVNCG-001'),
    ('00000000-0000-0000-0000-000000000664'::uuid, '00000000-0000-0000-0000-000000000202'::uuid, '00000000-0000-0000-0000-000000000652'::uuid, 'SVIP', 'Guest Chông Gai 2', '+84910000202', 'guest202@example.com', 'GUEST-ATVNCG-002'),
    ('00000000-0000-0000-0000-000000000665'::uuid, '00000000-0000-0000-0000-000000000203'::uuid, '00000000-0000-0000-0000-000000000653'::uuid, 'VIP', 'Guest Em Xinh 1', '+84910000301', 'guest301@example.com', 'GUEST-EXSH-001'),
    ('00000000-0000-0000-0000-000000000666'::uuid, '00000000-0000-0000-0000-000000000203'::uuid, '00000000-0000-0000-0000-000000000653'::uuid, 'SVIP', 'Guest Em Xinh 2', '+84910000302', 'guest302@example.com', 'GUEST-EXSH-002'),
    ('00000000-0000-0000-0000-000000000667'::uuid, '00000000-0000-0000-0000-000000000204'::uuid, '00000000-0000-0000-0000-000000000654'::uuid, 'VIP', 'Guest Chị Đẹp 1', '+84910000401', 'guest401@example.com', 'GUEST-CDDG-001'),
    ('00000000-0000-0000-0000-000000000668'::uuid, '00000000-0000-0000-0000-000000000204'::uuid, '00000000-0000-0000-0000-000000000654'::uuid, 'SVIP', 'Guest Chị Đẹp 2', '+84910000402', 'guest402@example.com', 'GUEST-CDDG-002')
) AS v(id, concert_id, import_job_id, zone_code, full_name, phone, email, code)
JOIN seat_zones z ON z.concert_id = v.concert_id AND z.code = v.zone_code
ON CONFLICT (id) DO UPDATE SET
  concert_id = EXCLUDED.concert_id,
  seat_zone_id = EXCLUDED.seat_zone_id,
  import_job_id = EXCLUDED.import_job_id,
  full_name = EXCLUDED.full_name,
  phone = EXCLUDED.phone,
  email = EXCLUDED.email,
  code = EXCLUDED.code,
  status = EXCLUDED.status,
  note = EXCLUDED.note;

INSERT INTO guest_import_errors (id, job_id, row_number, raw_data, error_code, error_message)
VALUES
  ('00000000-0000-0000-0000-000000000671', '00000000-0000-0000-0000-000000000651', 3, '{"phone": ""}'::jsonb, 'PHONE_REQUIRED', 'Phone is required for guest deduplication.')
ON CONFLICT (id) DO UPDATE SET
  job_id = EXCLUDED.job_id,
  row_number = EXCLUDED.row_number,
  raw_data = EXCLUDED.raw_data,
  error_code = EXCLUDED.error_code,
  error_message = EXCLUDED.error_message;

INSERT INTO artist_bio_jobs (id, concert_id, requested_by, status, source_file_url, extracted_text, generated_bio)
VALUES
  ('00000000-0000-0000-0000-000000000681', '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000002', 'DONE', 'https://storage.example.com/artist-bio/anh-trai-say-hi.pdf', 'Press kit demo.', 'Generated bio for Anh Trai Say Hi.'),
  ('00000000-0000-0000-0000-000000000682', '00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000002', 'DONE', 'https://storage.example.com/artist-bio/anh-trai-vuot-ngan-chong-gai.pdf', 'Press kit demo.', 'Generated bio for Anh Trai Vượt Ngàn Chông Gai.'),
  ('00000000-0000-0000-0000-000000000683', '00000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-000000000002', 'PROCESSING', 'https://storage.example.com/artist-bio/em-xinh-say-hi.pdf', 'Press kit demo.', NULL),
  ('00000000-0000-0000-0000-000000000684', '00000000-0000-0000-0000-000000000204', '00000000-0000-0000-0000-000000000002', 'PENDING', 'https://storage.example.com/artist-bio/chi-dep-dap-gio-re-song.pdf', NULL, NULL)
ON CONFLICT (id) DO UPDATE SET
  concert_id = EXCLUDED.concert_id,
  requested_by = EXCLUDED.requested_by,
  status = EXCLUDED.status,
  source_file_url = EXCLUDED.source_file_url,
  extracted_text = EXCLUDED.extracted_text,
  generated_bio = EXCLUDED.generated_bio,
  error_message = EXCLUDED.error_message;

INSERT INTO notifications (id, user_id, concert_id, ticket_id, channel, type, status, payload, attempts, sent_at)
VALUES
  ('00000000-0000-0000-0000-000000000691', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000631', 'EMAIL', 'TICKET_ISSUED', 'SENT', '{"subject": "Ticket issued"}'::jsonb, 1, '2026-06-02 10:06:00'),
  ('00000000-0000-0000-0000-000000000692', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000632', 'APP', 'ORDER_CONFIRMED', 'PENDING', '{"message": "Order confirmed"}'::jsonb, 0, NULL),
  ('00000000-0000-0000-0000-000000000693', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000203', NULL, 'APP', 'ARTIST_BIO_READY', 'PENDING', '{"job_id": "00000000-0000-0000-0000-000000000683"}'::jsonb, 0, NULL),
  ('00000000-0000-0000-0000-000000000694', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000204', NULL, 'SMS', 'CHECKIN_ALERT', 'FAILED', '{"message": "Demo failed SMS"}'::jsonb, 2, NULL)
ON CONFLICT (id) DO UPDATE SET
  user_id = EXCLUDED.user_id,
  concert_id = EXCLUDED.concert_id,
  ticket_id = EXCLUDED.ticket_id,
  channel = EXCLUDED.channel,
  type = EXCLUDED.type,
  status = EXCLUDED.status,
  payload = EXCLUDED.payload,
  attempts = EXCLUDED.attempts,
  sent_at = EXCLUDED.sent_at;

INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, metadata, ip_address, user_agent)
VALUES
  ('00000000-0000-0000-0000-000000000701', '00000000-0000-0000-0000-000000000002', 'CONCERT_PUBLISHED', 'concert', '00000000-0000-0000-0000-000000000201', '{"source": "seed"}'::jsonb, '127.0.0.1', 'seed.sql'),
  ('00000000-0000-0000-0000-000000000702', '00000000-0000-0000-0000-000000000002', 'GUEST_IMPORT_DONE', 'guest_import_job', '00000000-0000-0000-0000-000000000652', '{"source": "seed"}'::jsonb, '127.0.0.1', 'seed.sql'),
  ('00000000-0000-0000-0000-000000000703', '00000000-0000-0000-0000-000000000004', 'USER_ROLE_SET', 'user', '00000000-0000-0000-0000-000000000003', '{"role": "CHECKER"}'::jsonb, '127.0.0.1', 'seed.sql'),
  ('00000000-0000-0000-0000-000000000704', '00000000-0000-0000-0000-000000000002', 'ARTIST_BIO_JOB_CREATED', 'artist_bio_job', '00000000-0000-0000-0000-000000000681', '{"source": "seed"}'::jsonb, '127.0.0.1', 'seed.sql')
ON CONFLICT (id) DO UPDATE SET
  actor_user_id = EXCLUDED.actor_user_id,
  action = EXCLUDED.action,
  entity_type = EXCLUDED.entity_type,
  entity_id = EXCLUDED.entity_id,
  metadata = EXCLUDED.metadata,
  ip_address = EXCLUDED.ip_address,
  user_agent = EXCLUDED.user_agent;

INSERT INTO offline_checkin_batches (id, batch_token, device_id, staff_id, concert_id, gate_id, status, item_count, accepted_count, conflict_count, synced_at)
SELECT
  '00000000-0000-0000-0000-000000000721',
  'offline-batch-demo-001',
  d.id,
  d.staff_id,
  d.concert_id,
  d.gate_id,
  'PENDING',
  1,
  0,
  0,
  NULL
FROM checkin_devices d
WHERE d.id = '00000000-0000-0000-0000-000000000641'
ON CONFLICT (id) DO UPDATE SET
  batch_token = EXCLUDED.batch_token,
  device_id = EXCLUDED.device_id,
  staff_id = EXCLUDED.staff_id,
  concert_id = EXCLUDED.concert_id,
  gate_id = EXCLUDED.gate_id,
  status = EXCLUDED.status,
  item_count = EXCLUDED.item_count,
  accepted_count = EXCLUDED.accepted_count,
  conflict_count = EXCLUDED.conflict_count,
  synced_at = EXCLUDED.synced_at;

INSERT INTO offline_checkin_items (id, batch_id, ticket_id, qr_token_hash, gate_id, seat_zone_id, result, scanned_at, metadata)
SELECT
  '00000000-0000-0000-0000-000000000731',
  '00000000-0000-0000-0000-000000000721',
  t.id,
  t.qr_token_hash,
  d.gate_id,
  t.seat_zone_id,
  'PENDING',
  '2026-06-02 11:05:00'::timestamp,
  '{"source": "mobile-offline-demo"}'::jsonb
FROM tickets t
JOIN checkin_devices d ON d.id = '00000000-0000-0000-0000-000000000641'
WHERE t.id = '00000000-0000-0000-0000-000000000631'
ON CONFLICT (id) DO UPDATE SET
  batch_id = EXCLUDED.batch_id,
  ticket_id = EXCLUDED.ticket_id,
  qr_token_hash = EXCLUDED.qr_token_hash,
  gate_id = EXCLUDED.gate_id,
  seat_zone_id = EXCLUDED.seat_zone_id,
  result = EXCLUDED.result,
  scanned_at = EXCLUDED.scanned_at,
  metadata = EXCLUDED.metadata;

COMMIT;
