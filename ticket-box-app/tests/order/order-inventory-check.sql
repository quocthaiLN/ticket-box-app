WITH ticket_type_inventory AS (
  SELECT
    tt.id AS ticket_type_id,
    tt.name AS ticket_type,
    tt.total_quantity,
    tt.held_quantity AS inventory_held_quantity,
    tt.sold_quantity
  FROM concerts c
  JOIN ticket_types tt ON tt.concert_id = c.id
  WHERE c.id = '00000000-0000-0000-0000-000000000201'
),
order_items_by_ticket_type AS (
  SELECT
    oi.ticket_type_id,
    COALESCE(SUM(oi.quantity) FILTER (WHERE o.status = 'HELD'), 0) AS held_quantity
  FROM concerts c
  JOIN orders o ON o.concert_id = c.id
  JOIN order_items oi ON oi.order_id = o.id
  JOIN ticket_types tt ON tt.id = oi.ticket_type_id AND tt.concert_id = c.id
  WHERE c.id = '00000000-0000-0000-0000-000000000201'
  GROUP BY oi.ticket_type_id
),
held_orders_without_items AS (
  SELECT COUNT(*)::bigint AS quantity
  FROM orders o
  WHERE o.concert_id = '00000000-0000-0000-0000-000000000201'
    AND o.status = 'HELD'
    AND NOT EXISTS (
      SELECT 1
      FROM order_items oi
      WHERE oi.order_id = o.id
    )
)
SELECT
  i.ticket_type,
  i.total_quantity,
  i.inventory_held_quantity,
  i.sold_quantity,
  COALESCE(o.held_quantity, 0) AS held_order_item_quantity,
  COALESCE(o.held_quantity, 0) - i.inventory_held_quantity AS ledger_gap,
  (SELECT quantity FROM held_orders_without_items) AS held_orders_without_items
FROM ticket_type_inventory i
LEFT JOIN order_items_by_ticket_type o ON o.ticket_type_id = i.ticket_type_id
ORDER BY i.ticket_type;
