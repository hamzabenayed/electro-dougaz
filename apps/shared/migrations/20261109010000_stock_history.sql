-- Historical quantities cannot be reconstructed reliably. Leave old rows NULL.
ALTER TABLE stock_movements ADD COLUMN stock_before integer;
ALTER TABLE stock_movements ADD COLUMN stock_after integer;
ALTER TABLE stock_movements ADD COLUMN request_key uuid UNIQUE;
ALTER TABLE stock_movements DROP CONSTRAINT stock_movements_reason_check;
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_reason_check
  CHECK (reason IN ('order_reserved','order_cancelled','manual_adjustment','restock','return','initial_stock','product_edit'));
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_balances_check
  CHECK (stock_before >= 0 AND stock_after >= 0 AND stock_after = stock_before + quantity_delta);

-- Writers update/lock the variant before inserting its movement in the same transaction.
CREATE FUNCTION capture_stock_balances() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  SELECT stock_quantity INTO NEW.stock_after FROM product_variants WHERE id=NEW.variant_id;
  NEW.stock_before := NEW.stock_after - NEW.quantity_delta;
  RETURN NEW;
END;
$$;
CREATE TRIGGER stock_movement_balances BEFORE INSERT ON stock_movements
  FOR EACH ROW EXECUTE FUNCTION capture_stock_balances();
CREATE INDEX stock_movements_history_idx ON stock_movements(created_at DESC, id DESC);
