-- Keep denormalized ticket columns aligned with their source records.

CREATE OR REPLACE FUNCTION sync_ticket_denormalized_fields()
RETURNS trigger AS $$
DECLARE
  source_order_id uuid;
  source_user_id uuid;
  source_order_concert_id uuid;
  source_ticket_type_id uuid;
  source_ticket_type_concert_id uuid;
  source_zone_id uuid;
BEGIN
  SELECT
    oi.order_id,
    o.user_id,
    o.concert_id,
    oi.ticket_type_id,
    tt.concert_id,
    tt.zone_id
  INTO
    source_order_id,
    source_user_id,
    source_order_concert_id,
    source_ticket_type_id,
    source_ticket_type_concert_id,
    source_zone_id
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
  NEW.zone_id := source_zone_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tickets_sync_denormalized_fields
  BEFORE INSERT OR UPDATE OF order_item_id, order_id, user_id, concert_id, ticket_type_id, zone_id
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

CREATE TRIGGER trg_orders_prevent_ticket_source_mutation
  BEFORE UPDATE OF user_id, concert_id ON orders
  FOR EACH ROW
  WHEN (OLD.user_id IS DISTINCT FROM NEW.user_id OR OLD.concert_id IS DISTINCT FROM NEW.concert_id)
  EXECUTE FUNCTION prevent_ticket_order_source_mutation();

CREATE OR REPLACE FUNCTION prevent_ticket_type_source_mutation()
RETURNS trigger AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM tickets WHERE ticket_type_id = OLD.id LIMIT 1) THEN
    RAISE EXCEPTION 'Ticket type % cannot change concert_id or zone_id after tickets are issued', OLD.id
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ticket_types_prevent_ticket_source_mutation
  BEFORE UPDATE OF concert_id, zone_id ON ticket_types
  FOR EACH ROW
  WHEN (OLD.concert_id IS DISTINCT FROM NEW.concert_id OR OLD.zone_id IS DISTINCT FROM NEW.zone_id)
  EXECUTE FUNCTION prevent_ticket_type_source_mutation();
