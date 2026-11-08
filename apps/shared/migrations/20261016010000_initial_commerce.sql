CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE CHECK (email = lower(email)),
  display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 2 AND 100),
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('owner', 'manager', 'fulfillment')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE admin_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_sessions_user_id_idx ON admin_sessions(user_id);
CREATE INDEX admin_sessions_expires_at_idx ON admin_sessions(expires_at);

CREATE TABLE categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 100),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text,
  is_visible boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 180),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX products_category_id_idx ON products(category_id);
CREATE INDEX products_status_idx ON products(status);

CREATE TABLE product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku text NOT NULL UNIQUE,
  name text NOT NULL DEFAULT 'Standard',
  price_millimes integer NOT NULL CHECK (price_millimes >= 0),
  compare_at_price_millimes integer CHECK (compare_at_price_millimes IS NULL OR compare_at_price_millimes >= price_millimes),
  stock_quantity integer NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  low_stock_threshold integer NOT NULL DEFAULT 3 CHECK (low_stock_threshold >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX product_variants_product_id_idx ON product_variants(product_id);

CREATE TABLE product_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  object_key text NOT NULL,
  alt_text text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_id, object_key)
);

CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE,
  customer_first_name text NOT NULL,
  customer_last_name text NOT NULL,
  phone text NOT NULL,
  governorate text NOT NULL,
  address text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','awaiting_payment','payment_failed','confirmed','preparing','shipped','delivered','delivery_failed','returned','refund_requested','refunded','cancelled')),
  payment_method text NOT NULL CHECK (payment_method IN ('cash_on_delivery','online_card')),
  payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending','paid','failed','refunded')),
  subtotal_millimes integer NOT NULL CHECK (subtotal_millimes >= 0),
  delivery_millimes integer NOT NULL CHECK (delivery_millimes >= 0),
  total_millimes integer NOT NULL CHECK (total_millimes = subtotal_millimes + delivery_millimes),
  idempotency_key text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX orders_phone_idx ON orders(phone);
CREATE INDEX orders_status_created_at_idx ON orders(status, created_at DESC);

CREATE TABLE order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  variant_id uuid NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
  product_name text NOT NULL,
  sku text NOT NULL,
  unit_price_millimes integer NOT NULL CHECK (unit_price_millimes >= 0),
  quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 99),
  line_total_millimes integer NOT NULL CHECK (line_total_millimes = unit_price_millimes * quantity)
);
CREATE INDEX order_items_order_id_idx ON order_items(order_id);

CREATE TABLE stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id uuid NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  quantity_delta integer NOT NULL CHECK (quantity_delta <> 0),
  reason text NOT NULL CHECK (reason IN ('order_reserved','order_cancelled','manual_adjustment','restock','return')),
  note text,
  actor_user_id uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX stock_movements_variant_id_created_at_idx ON stock_movements(variant_id, created_at DESC);

CREATE TABLE order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  actor_user_id uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_created_at_idx ON audit_logs(created_at DESC);

INSERT INTO categories (name, slug, sort_order) VALUES
  ('Smartphones', 'smartphones', 10),
  ('Informatique', 'informatique', 20),
  ('TV & image', 'tv-image', 30),
  ('Audio', 'audio', 40),
  ('Électroménager', 'electromenager', 50),
  ('Gaming', 'gaming', 60)
ON CONFLICT (slug) DO NOTHING;
