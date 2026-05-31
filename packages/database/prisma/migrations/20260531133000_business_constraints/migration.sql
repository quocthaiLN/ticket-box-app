-- Business invariants that Prisma schema cannot express directly.

ALTER TABLE venues
  ADD CONSTRAINT ck_venues_capacity_positive
  CHECK (capacity IS NULL OR capacity > 0);

ALTER TABLE venue_zones
  ADD CONSTRAINT ck_venue_zones_capacity_positive
  CHECK (capacity > 0);

ALTER TABLE concerts
  ADD CONSTRAINT ck_concerts_time_range
  CHECK (ends_at > starts_at);

ALTER TABLE ticket_types
  ADD CONSTRAINT ck_ticket_types_price_non_negative
  CHECK (price >= 0),
  ADD CONSTRAINT ck_ticket_types_total_quantity_non_negative
  CHECK (total_quantity >= 0),
  ADD CONSTRAINT ck_ticket_types_max_per_user_positive
  CHECK (max_per_user > 0),
  ADD CONSTRAINT ck_ticket_types_sale_time_range
  CHECK (sale_end_at > sale_start_at);

ALTER TABLE ticket_inventories
  ADD CONSTRAINT ck_ticket_inventories_counts_non_negative
  CHECK (total >= 0 AND available >= 0 AND reserved >= 0 AND sold >= 0),
  ADD CONSTRAINT ck_ticket_inventories_quantity_sum
  CHECK (total = available + reserved + sold),
  ADD CONSTRAINT ck_ticket_inventories_version_non_negative
  CHECK (version >= 0);

ALTER TABLE inventory_reservations
  ADD CONSTRAINT ck_inventory_reservations_quantity_positive
  CHECK (quantity > 0),
  ADD CONSTRAINT ck_inventory_reservations_expires_after_created
  CHECK (expires_at > created_at),
  ADD CONSTRAINT ck_inventory_reservations_confirmed_at_required
  CHECK (status <> 'confirmed' OR confirmed_at IS NOT NULL);

ALTER TABLE user_ticket_type_counters
  ADD CONSTRAINT ck_user_ticket_type_counters_counts_non_negative
  CHECK (held_quantity >= 0 AND paid_quantity >= 0 AND refunded_quantity >= 0),
  ADD CONSTRAINT ck_user_ticket_type_counters_refund_not_over_paid
  CHECK (refunded_quantity <= paid_quantity);

ALTER TABLE ticket_inventory_events
  ADD CONSTRAINT ck_ticket_inventory_events_quantity_positive
  CHECK (quantity > 0),
  ADD CONSTRAINT ck_ticket_inventory_events_before_after_non_negative
  CHECK (
    (before_total IS NULL OR before_total >= 0) AND
    (after_total IS NULL OR after_total >= 0) AND
    (before_available IS NULL OR before_available >= 0) AND
    (after_available IS NULL OR after_available >= 0) AND
    (before_reserved IS NULL OR before_reserved >= 0) AND
    (after_reserved IS NULL OR after_reserved >= 0) AND
    (before_sold IS NULL OR before_sold >= 0) AND
    (after_sold IS NULL OR after_sold >= 0)
  );

ALTER TABLE orders
  ADD CONSTRAINT ck_orders_total_amount_non_negative
  CHECK (total_amount >= 0);

ALTER TABLE order_items
  ADD CONSTRAINT ck_order_items_quantity_positive
  CHECK (quantity > 0),
  ADD CONSTRAINT ck_order_items_unit_price_non_negative
  CHECK (unit_price >= 0),
  ADD CONSTRAINT ck_order_items_line_total_non_negative
  CHECK (line_total >= 0),
  ADD CONSTRAINT ck_order_items_line_total_matches_quantity
  CHECK (line_total = quantity * unit_price);

ALTER TABLE payments
  ADD CONSTRAINT ck_payments_amount_positive
  CHECK (amount > 0),
  ADD CONSTRAINT ck_payments_paid_at_required
  CHECK (status <> 'success' OR paid_at IS NOT NULL);

ALTER TABLE tickets
  ADD CONSTRAINT ck_tickets_checked_in_at_required
  CHECK (status <> 'checked_in' OR checked_in_at IS NOT NULL);

ALTER TABLE offline_checkin_batches
  ADD CONSTRAINT ck_offline_checkin_batches_counts_non_negative
  CHECK (item_count >= 0 AND conflict_count >= 0);

ALTER TABLE offline_checkin_items
  ADD CONSTRAINT ck_offline_checkin_items_has_target
  CHECK (qr_token_hash IS NOT NULL OR ticket_id IS NOT NULL OR guest_id IS NOT NULL);

CREATE OR REPLACE FUNCTION validate_gate_zone_same_venue()
RETURNS trigger AS $$
DECLARE
  gate_venue_id uuid;
  zone_venue_id uuid;
BEGIN
  SELECT venue_id INTO gate_venue_id
  FROM gates
  WHERE id = NEW.gate_id;

  SELECT venue_id INTO zone_venue_id
  FROM venue_zones
  WHERE id = NEW.zone_id;

  IF gate_venue_id IS NULL OR zone_venue_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF gate_venue_id <> zone_venue_id THEN
    RAISE EXCEPTION 'Gate % and zone % must belong to the same venue', NEW.gate_id, NEW.zone_id
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_gate_zones_same_venue
  BEFORE INSERT OR UPDATE ON gate_zones
  FOR EACH ROW
  EXECUTE FUNCTION validate_gate_zone_same_venue();

CREATE OR REPLACE FUNCTION validate_gate_venue_change()
RETURNS trigger AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM gate_zones gz
    JOIN venue_zones vz ON vz.id = gz.zone_id
    WHERE gz.gate_id = NEW.id
      AND vz.venue_id <> NEW.venue_id
  ) THEN
    RAISE EXCEPTION 'Gate % cannot move to a venue that conflicts with mapped zones', NEW.id
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_gates_same_venue_on_update
  BEFORE UPDATE OF venue_id ON gates
  FOR EACH ROW
  EXECUTE FUNCTION validate_gate_venue_change();

CREATE OR REPLACE FUNCTION validate_zone_venue_change()
RETURNS trigger AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM gate_zones gz
    JOIN gates g ON g.id = gz.gate_id
    WHERE gz.zone_id = NEW.id
      AND g.venue_id <> NEW.venue_id
  ) THEN
    RAISE EXCEPTION 'Zone % cannot move to a venue that conflicts with mapped gates', NEW.id
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_venue_zones_same_venue_on_update
  BEFORE UPDATE OF venue_id ON venue_zones
  FOR EACH ROW
  EXECUTE FUNCTION validate_zone_venue_change();
