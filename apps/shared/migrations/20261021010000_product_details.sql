ALTER TABLE products ADD COLUMN specifications jsonb NOT NULL DEFAULT '[]'::jsonb
  CHECK (jsonb_typeof(specifications) = 'array');
ALTER TABLE products ADD COLUMN warranty text NOT NULL DEFAULT '';
ALTER TABLE product_variants ADD COLUMN sort_order integer NOT NULL DEFAULT 0;
CREATE INDEX product_media_product_sort_idx ON product_media(product_id, sort_order, id);
CREATE TABLE public_rate_limits (
  key text PRIMARY KEY,
  hits integer NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE INDEX public_rate_limits_expiry_idx ON public_rate_limits(expires_at);
