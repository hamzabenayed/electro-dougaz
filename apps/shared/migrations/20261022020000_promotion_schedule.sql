ALTER TABLE products ADD COLUMN promotion_starts_at timestamptz;
ALTER TABLE products ADD COLUMN promotion_ends_at timestamptz;
ALTER TABLE products ADD CONSTRAINT promotion_dates_valid CHECK(promotion_ends_at IS NULL OR promotion_starts_at IS NULL OR promotion_ends_at>promotion_starts_at);
CREATE FUNCTION promotion_active(starts_at timestamptz,ends_at timestamptz) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT (starts_at IS NULL OR starts_at<=now()) AND (ends_at IS NULL OR ends_at>now())
$$;
CREATE FUNCTION effective_price(price integer,original integer,starts_at timestamptz,ends_at timestamptz) RETURNS integer LANGUAGE sql STABLE AS $$
 SELECT CASE WHEN original>price AND NOT promotion_active(starts_at,ends_at) THEN original ELSE price END
$$;
