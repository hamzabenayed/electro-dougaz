'use client';

import { useId, useState } from 'react';
import { remainingQuantity, useCart, type CartProduct } from './cart-context';
import { AddToCartButton, BuyNowButton } from './cart-controls';
import { formatPrice } from '../lib/catalog';

export function ProductPurchase({ product }: Readonly<{ product: CartProduct }>) {
  const { lines, hydrated, openCart } = useCart();
  const [requested, setRequested] = useState(1);
  const id = useId();
  const remaining = remainingQuantity(product, lines);
  const quantity = Math.min(requested, remaining);
  const inCart =
    lines.find((line) => (line.variantId ?? line.id) === (product.variantId ?? product.id))
      ?.quantity ?? 0;

  return (
    <div className="product-purchase">
      <div className="product-quantity">
        <label htmlFor={id}>Quantité</label>
        <select
          id={id}
          value={quantity}
          disabled={!hydrated || remaining === 0}
          onChange={(event) => setRequested(Number(event.target.value))}
        >
          {remaining === 0 ? (
            <option value={0}>0</option>
          ) : (
            Array.from({ length: remaining }, (_, index) => (
              <option key={index + 1} value={index + 1}>
                {index + 1}
              </option>
            ))
          )}
        </select>
        {quantity > 0 ? (
          <span>
            Total sélectionné : <strong>{formatPrice(product.price * quantity)} DT</strong>
          </span>
        ) : null}
      </div>
      {inCart > 0 ? (
        <p role="status">
          {inCart} déjà dans votre panier.{' '}
          <button type="button" className="text-button" onClick={openCart}>
            Modifier le panier
          </button>
        </p>
      ) : null}
      {remaining === 0 && inCart > 0 ? <p>Quantité maximale atteinte pour cet article.</p> : null}
      <div className="purchase-actions">
        <AddToCartButton product={product} quantity={quantity} />
        <BuyNowButton product={product} quantity={quantity} />
      </div>
    </div>
  );
}
