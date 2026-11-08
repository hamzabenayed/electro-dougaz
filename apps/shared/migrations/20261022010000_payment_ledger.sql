CREATE TABLE order_payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id),
  kind text NOT NULL CHECK (kind IN ('collected','received','refunded')),
  amount_millimes integer NOT NULL CHECK (amount_millimes > 0),
  note text NOT NULL CHECK (length(note) BETWEEN 3 AND 300),
  actor_user_id uuid NOT NULL REFERENCES admin_users(id),
  request_key uuid NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX order_payment_events_order_idx ON order_payment_events(order_id,created_at);
CREATE INDEX order_payment_events_date_idx ON order_payment_events(created_at);
