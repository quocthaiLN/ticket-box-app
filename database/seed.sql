
-- seed.sql
-- Sample data for TicketBox. All concert prices, quantities and dates below are fictional and used for demo only.

BEGIN;

INSERT INTO roles (code, name, description) VALUES
('CUSTOMER', 'Khán giả', 'Xem concert, mua vé và nhận e-ticket.'),
('ORGANIZER', 'Ban tổ chức', 'Tạo, cập nhật, hủy concert và cấu hình vé.'),
('CHECKIN_STAFF', 'Nhân sự soát vé', 'Quét QR, xác nhận vé và đồng bộ check-in offline.'),
('ADMIN', 'Quản trị hệ thống', 'Quản lý toàn bộ hệ thống và phân quyền.')
ON CONFLICT (code) DO NOTHING;

INSERT INTO venues (id, name, address, city, capacity, map_url) VALUES
('00000000-0000-0000-0000-000000000101', 'Sân vận động Quốc gia Mỹ Đình', 'Đường Lê Đức Thọ, Nam Từ Liêm', 'Hà Nội', 40000, 'https://maps.example.com/my-dinh'),
('00000000-0000-0000-0000-000000000102', 'Nhà thi đấu Phú Thọ', '221 Lý Thường Kiệt, Quận 11', 'TP. Hồ Chí Minh', 5000, 'https://maps.example.com/phu-tho'),
('00000000-0000-0000-0000-000000000103', 'SECC Hall A', '799 Nguyễn Văn Linh, Quận 7', 'TP. Hồ Chí Minh', 12000, 'https://maps.example.com/secc'),
('00000000-0000-0000-0000-000000000104', 'Sân vận động Quân khu 7', '202 Hoàng Văn Thụ, Tân Bình', 'TP. Hồ Chí Minh', 25000, 'https://maps.example.com/qk7')
ON CONFLICT (id) DO NOTHING;

INSERT INTO concerts (id, venue_id, title, slug, description, artist_name, starts_at, ends_at, status, cover_image_url) VALUES
('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000101', 'Anh Trai Say Hi', 'anh-trai-say-hi', 'Concert demo cho hệ thống TicketBox, dữ liệu không đại diện sự kiện thật.', 'Various Artists', '2026-07-25 19:30:00+07', '2026-07-25 23:00:00+07', 'PUBLISHED', 'https://cdn.example.com/ticketbox/anh-trai-say-hi.jpg'),
('00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000102', 'Anh Trai Vượt Ngàn Chông Gai', 'anh-trai-vuot-ngan-chong-gai', 'Concert demo cho hệ thống TicketBox, dữ liệu không đại diện sự kiện thật.', 'Various Artists', '2026-08-08 19:30:00+07', '2026-08-08 23:00:00+07', 'PUBLISHED', 'https://cdn.example.com/ticketbox/anh-trai-vuot-ngan-chong-gai.jpg'),
('00000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-000000000103', 'Em Xinh Say Hi', 'em-xinh-say-hi', 'Concert demo cho hệ thống TicketBox, dữ liệu không đại diện sự kiện thật.', 'Various Artists', '2026-09-12 19:30:00+07', '2026-09-12 23:00:00+07', 'PUBLISHED', 'https://cdn.example.com/ticketbox/em-xinh-say-hi.jpg'),
('00000000-0000-0000-0000-000000000204', '00000000-0000-0000-0000-000000000104', 'Chị Đẹp Đạp Gió Rẽ Sóng', 'chi-dep-dap-gio-re-song', 'Concert demo cho hệ thống TicketBox, dữ liệu không đại diện sự kiện thật.', 'Various Artists', '2026-10-03 19:30:00+07', '2026-10-03 23:00:00+07', 'PUBLISHED', 'https://cdn.example.com/ticketbox/chi-dep-dap-gio-re-song.jpg')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO seat_zones (concert_id, code, name, description, capacity, svg_path, sort_order)
SELECT c.id, v.code, v.name, v.description, v.capacity, v.svg_path, v.sort_order
FROM concerts c
JOIN (VALUES
    ('anh-trai-say-hi', 'GA', 'General Admission', 'Khu đứng tự do phía sau.', 14000, 'M10 10 H110 V110 H10 Z', 5),
    ('anh-trai-say-hi', 'SVIP', 'SVIP', 'Khu gần sân khấu, số lượng giới hạn.', 200, 'M120 10 H180 V70 H120 Z', 1),
    ('anh-trai-say-hi', 'VIP', 'VIP', 'Khu ưu tiên tầm nhìn tốt.', 1800, 'M190 10 H260 V90 H190 Z', 2),
    ('anh-trai-say-hi', 'CAT1', 'CAT1', 'Khu ghế trung tâm.', 6000, 'M270 10 H360 V130 H270 Z', 3),
    ('anh-trai-say-hi', 'CAT2', 'CAT2', 'Khu ghế phổ thông.', 10000, 'M370 10 H480 V160 H370 Z', 4),

    ('anh-trai-vuot-ngan-chong-gai', 'GA', 'General Admission', 'Khu đứng tự do.', 1200, 'M10 10 H110 V110 H10 Z', 5),
    ('anh-trai-vuot-ngan-chong-gai', 'SVIP', 'SVIP', 'Khu gần sân khấu.', 250, 'M120 10 H180 V70 H120 Z', 1),
    ('anh-trai-vuot-ngan-chong-gai', 'VIP', 'VIP', 'Khu ưu tiên.', 600, 'M190 10 H260 V90 H190 Z', 2),
    ('anh-trai-vuot-ngan-chong-gai', 'CAT1', 'CAT1', 'Khu ghế trung tâm.', 1200, 'M270 10 H360 V130 H270 Z', 3),
    ('anh-trai-vuot-ngan-chong-gai', 'CAT2', 'CAT2', 'Khu ghế phổ thông.', 1500, 'M370 10 H480 V160 H370 Z', 4),

    ('em-xinh-say-hi', 'GA', 'General Admission', 'Khu đứng tự do.', 4000, 'M10 10 H110 V110 H10 Z', 5),
    ('em-xinh-say-hi', 'SVIP', 'SVIP', 'Khu gần sân khấu.', 500, 'M120 10 H180 V70 H120 Z', 1),
    ('em-xinh-say-hi', 'VIP', 'VIP', 'Khu ưu tiên.', 1200, 'M190 10 H260 V90 H190 Z', 2),
    ('em-xinh-say-hi', 'CAT1', 'CAT1', 'Khu ghế trung tâm.', 3000, 'M270 10 H360 V130 H270 Z', 3),
    ('em-xinh-say-hi', 'CAT2', 'CAT2', 'Khu ghế phổ thông.', 3300, 'M370 10 H480 V160 H370 Z', 4),

    ('chi-dep-dap-gio-re-song', 'GA', 'General Admission', 'Khu đứng tự do.', 9000, 'M10 10 H110 V110 H10 Z', 5),
    ('chi-dep-dap-gio-re-song', 'SVIP', 'SVIP', 'Khu gần sân khấu.', 400, 'M120 10 H180 V70 H120 Z', 1),
    ('chi-dep-dap-gio-re-song', 'VIP', 'VIP', 'Khu ưu tiên.', 1600, 'M190 10 H260 V90 H190 Z', 2),
    ('chi-dep-dap-gio-re-song', 'CAT1', 'CAT1', 'Khu ghế trung tâm.', 6000, 'M270 10 H360 V130 H270 Z', 3),
    ('chi-dep-dap-gio-re-song', 'CAT2', 'CAT2', 'Khu ghế phổ thông.', 8000, 'M370 10 H480 V160 H370 Z', 4)
) AS v(slug, code, name, description, capacity, svg_path, sort_order)
ON c.slug = v.slug
ON CONFLICT (concert_id, code) DO NOTHING;


INSERT INTO checkin_gates (concert_id, gate_code, gate_name, description, is_active)
SELECT c.id, v.gate_code, v.gate_name, v.description, TRUE
FROM concerts c
JOIN (VALUES
    ('anh-trai-say-hi', 'GA_GATE', 'Cổng GA', 'Cổng dành cho khu GA.'),
    ('anh-trai-say-hi', 'SVIP_GATE', 'Cổng SVIP', 'Cổng dành cho khu SVIP.'),
    ('anh-trai-say-hi', 'VIP_GATE', 'Cổng VIP', 'Cổng dành cho khu VIP.'),
    ('anh-trai-say-hi', 'CAT1_GATE', 'Cổng CAT1', 'Cổng dành cho khu CAT1.'),
    ('anh-trai-say-hi', 'CAT2_GATE', 'Cổng CAT2', 'Cổng dành cho khu CAT2.'),

    ('anh-trai-vuot-ngan-chong-gai', 'GA_GATE', 'Cổng GA', 'Cổng dành cho khu GA.'),
    ('anh-trai-vuot-ngan-chong-gai', 'SVIP_GATE', 'Cổng SVIP', 'Cổng dành cho khu SVIP.'),
    ('anh-trai-vuot-ngan-chong-gai', 'VIP_GATE', 'Cổng VIP', 'Cổng dành cho khu VIP.'),
    ('anh-trai-vuot-ngan-chong-gai', 'CAT1_GATE', 'Cổng CAT1', 'Cổng dành cho khu CAT1.'),
    ('anh-trai-vuot-ngan-chong-gai', 'CAT2_GATE', 'Cổng CAT2', 'Cổng dành cho khu CAT2.'),

    ('em-xinh-say-hi', 'GA_GATE', 'Cổng GA', 'Cổng dành cho khu GA.'),
    ('em-xinh-say-hi', 'SVIP_GATE', 'Cổng SVIP', 'Cổng dành cho khu SVIP.'),
    ('em-xinh-say-hi', 'VIP_GATE', 'Cổng VIP', 'Cổng dành cho khu VIP.'),
    ('em-xinh-say-hi', 'CAT1_GATE', 'Cổng CAT1', 'Cổng dành cho khu CAT1.'),
    ('em-xinh-say-hi', 'CAT2_GATE', 'Cổng CAT2', 'Cổng dành cho khu CAT2.'),

    ('chi-dep-dap-gio-re-song', 'GA_GATE', 'Cổng GA', 'Cổng dành cho khu GA.'),
    ('chi-dep-dap-gio-re-song', 'SVIP_GATE', 'Cổng SVIP', 'Cổng dành cho khu SVIP.'),
    ('chi-dep-dap-gio-re-song', 'VIP_GATE', 'Cổng VIP', 'Cổng dành cho khu VIP.'),
    ('chi-dep-dap-gio-re-song', 'CAT1_GATE', 'Cổng CAT1', 'Cổng dành cho khu CAT1.'),
    ('chi-dep-dap-gio-re-song', 'CAT2_GATE', 'Cổng CAT2', 'Cổng dành cho khu CAT2.')
) AS v(slug, gate_code, gate_name, description)
ON c.slug = v.slug
ON CONFLICT (concert_id, gate_code) DO NOTHING;

INSERT INTO checkin_gate_zones (gate_id, seat_zone_id)
SELECT g.id, z.id
FROM checkin_gates g
JOIN concerts c ON c.id = g.concert_id
JOIN seat_zones z ON z.concert_id = c.id
WHERE
    (g.gate_code = 'GA_GATE' AND z.code = 'GA') OR
    (g.gate_code = 'SVIP_GATE' AND z.code = 'SVIP') OR
    (g.gate_code = 'VIP_GATE' AND z.code = 'VIP') OR
    (g.gate_code = 'CAT1_GATE' AND z.code = 'CAT1') OR
    (g.gate_code = 'CAT2_GATE' AND z.code = 'CAT2')
ON CONFLICT (gate_id, seat_zone_id) DO NOTHING;

INSERT INTO ticket_types (concert_id, seat_zone_id, name, description, price, currency, total_quantity, available_quantity, held_quantity, sold_quantity, max_per_user, sale_start_at, sale_end_at, status)
SELECT c.id, z.id, v.name, v.description, v.price, 'VND', v.quantity, v.quantity, 0, 0, v.max_per_user, v.sale_start_at::timestamptz, v.sale_end_at::timestamptz, 'ON_SALE'
FROM concerts c
JOIN seat_zones z ON z.concert_id = c.id
JOIN (VALUES
    ('anh-trai-say-hi', 'SVIP', 'SVIP Standard', 'Vé SVIP số lượng giới hạn.', 3500000.00, 200, 2, '2026-06-01 10:00:00+07', '2026-07-20 23:59:59+07'),
    ('anh-trai-say-hi', 'VIP', 'VIP Standard', 'Vé VIP.', 2500000.00, 1800, 2, '2026-06-01 10:00:00+07', '2026-07-20 23:59:59+07'),
    ('anh-trai-say-hi', 'CAT1', 'CAT1 Standard', 'Vé CAT1.', 1800000.00, 6000, 4, '2026-06-01 10:00:00+07', '2026-07-20 23:59:59+07'),
    ('anh-trai-say-hi', 'CAT2', 'CAT2 Standard', 'Vé CAT2.', 1200000.00, 10000, 4, '2026-06-01 10:00:00+07', '2026-07-20 23:59:59+07'),
    ('anh-trai-say-hi', 'GA', 'GA Standard', 'Vé đứng GA.', 900000.00, 14000, 4, '2026-06-01 10:00:00+07', '2026-07-20 23:59:59+07'),

    ('anh-trai-vuot-ngan-chong-gai', 'SVIP', 'SVIP Standard', 'Vé SVIP.', 3000000.00, 250, 2, '2026-06-15 10:00:00+07', '2026-08-03 23:59:59+07'),
    ('anh-trai-vuot-ngan-chong-gai', 'VIP', 'VIP Standard', 'Vé VIP.', 2200000.00, 600, 2, '2026-06-15 10:00:00+07', '2026-08-03 23:59:59+07'),
    ('anh-trai-vuot-ngan-chong-gai', 'CAT1', 'CAT1 Standard', 'Vé CAT1.', 1600000.00, 1200, 4, '2026-06-15 10:00:00+07', '2026-08-03 23:59:59+07'),
    ('anh-trai-vuot-ngan-chong-gai', 'CAT2', 'CAT2 Standard', 'Vé CAT2.', 1000000.00, 1500, 4, '2026-06-15 10:00:00+07', '2026-08-03 23:59:59+07'),
    ('anh-trai-vuot-ngan-chong-gai', 'GA', 'GA Standard', 'Vé đứng GA.', 750000.00, 1200, 4, '2026-06-15 10:00:00+07', '2026-08-03 23:59:59+07'),

    ('em-xinh-say-hi', 'SVIP', 'SVIP Standard', 'Vé SVIP.', 3200000.00, 500, 2, '2026-07-01 10:00:00+07', '2026-09-07 23:59:59+07'),
    ('em-xinh-say-hi', 'VIP', 'VIP Standard', 'Vé VIP.', 2300000.00, 1200, 2, '2026-07-01 10:00:00+07', '2026-09-07 23:59:59+07'),
    ('em-xinh-say-hi', 'CAT1', 'CAT1 Standard', 'Vé CAT1.', 1700000.00, 3000, 4, '2026-07-01 10:00:00+07', '2026-09-07 23:59:59+07'),
    ('em-xinh-say-hi', 'CAT2', 'CAT2 Standard', 'Vé CAT2.', 1100000.00, 3300, 4, '2026-07-01 10:00:00+07', '2026-09-07 23:59:59+07'),
    ('em-xinh-say-hi', 'GA', 'GA Standard', 'Vé đứng GA.', 800000.00, 4000, 4, '2026-07-01 10:00:00+07', '2026-09-07 23:59:59+07'),

    ('chi-dep-dap-gio-re-song', 'SVIP', 'SVIP Standard', 'Vé SVIP.', 3400000.00, 400, 2, '2026-08-01 10:00:00+07', '2026-09-28 23:59:59+07'),
    ('chi-dep-dap-gio-re-song', 'VIP', 'VIP Standard', 'Vé VIP.', 2400000.00, 1600, 2, '2026-08-01 10:00:00+07', '2026-09-28 23:59:59+07'),
    ('chi-dep-dap-gio-re-song', 'CAT1', 'CAT1 Standard', 'Vé CAT1.', 1750000.00, 6000, 4, '2026-08-01 10:00:00+07', '2026-09-28 23:59:59+07'),
    ('chi-dep-dap-gio-re-song', 'CAT2', 'CAT2 Standard', 'Vé CAT2.', 1150000.00, 8000, 4, '2026-08-01 10:00:00+07', '2026-09-28 23:59:59+07'),
    ('chi-dep-dap-gio-re-song', 'GA', 'GA Standard', 'Vé đứng GA.', 850000.00, 9000, 4, '2026-08-01 10:00:00+07', '2026-09-28 23:59:59+07')
) AS v(slug, zone_code, name, description, price, quantity, max_per_user, sale_start_at, sale_end_at)
ON c.slug = v.slug AND z.code = v.zone_code
ON CONFLICT (concert_id, name) DO NOTHING;

INSERT INTO notification_templates (code, channel, subject, body, is_active) VALUES
('TICKET_PURCHASED', 'EMAIL', 'Xác nhận mua vé TicketBox', 'Bạn đã mua vé thành công. Vui lòng kiểm tra e-ticket QR trong tài khoản.', TRUE),
('TICKET_PURCHASED', 'APP', 'Mua vé thành công', 'E-ticket QR đã sẵn sàng trong mục Vé của tôi.', TRUE),
('CONCERT_REMINDER_24H', 'EMAIL', 'Nhắc lịch concert trong 24 giờ', 'Concert của bạn sẽ diễn ra trong 24 giờ tới. Vui lòng chuẩn bị QR để check-in.', TRUE),
('CONCERT_REMINDER_24H', 'APP', 'Concert sắp diễn ra', 'Concert sẽ diễn ra trong 24 giờ tới. Kiểm tra thông tin địa điểm và QR.', TRUE)
ON CONFLICT (code, channel) DO NOTHING;

COMMIT;
