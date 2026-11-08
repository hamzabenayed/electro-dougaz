CREATE TABLE product_accessories (
 product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
 accessory_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
 PRIMARY KEY(product_id,accessory_id),
 CHECK(product_id<>accessory_id)
);
