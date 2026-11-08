'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { remainingQuantity, useCart, type CartProduct } from './cart-context';

function CartIcon({ size = 22 }: Readonly<{ size?: number }>) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 4h2l2.1 9.1a2 2 0 0 0 2 1.6h6.8a2 2 0 0 0 2-1.6L19 7H6m4 12h.01M17 19h.01" />
    </svg>
  );
}

export function AddToCartButton({
  product,
  compact = false,
  quantity = 1
}: Readonly<{ product: CartProduct; compact?: boolean; quantity?: number }>) {
  const { add, lines, hydrated } = useCart();
  const [added, setAdded] = useState(false);
  return (
    <button
      className={compact ? 'add-button' : 'primary-button buy-control'}
      type="button"
      disabled={!hydrated || quantity < 1 || quantity > remainingQuantity(product, lines)}
      onClick={() => {
        add(product, quantity);
        setAdded(true);
        window.setTimeout(() => setAdded(false), 1400);
      }}
      aria-label={`Ajouter ${product.name} au panier`}
    >
      {added ? 'Ajouté ✓' : compact ? 'Ajouter' : 'Ajouter au panier'}
    </button>
  );
}

export function CartSummaryButton({ className = '' }: Readonly<{ className?: string }>) {
  const { count, hydrated, total, isOpen, openCart } = useCart();
  return (
    <button
      type="button"
      onClick={openCart}
      aria-haspopup="dialog"
      aria-expanded={isOpen}
      aria-controls="cart-drawer"
      className={className}
      aria-label={`Panier, ${count} article${count === 1 ? '' : 's'}`}
    >
      <span className="cart-symbol">
        <CartIcon />
      </span>
      <span>
        <small>Votre panier</small>
        {hydrated ? `${total.toFixed(3).replace('.', ',')} DT` : 'Panier'}
      </span>
      {hydrated && count > 0 ? <b>{count > 99 ? '99+' : count}</b> : null}
    </button>
  );
}

export function MobileCartButton() {
  const { count, hydrated, isOpen, openCart } = useCart();
  return (
    <button
      type="button"
      onClick={openCart}
      aria-haspopup="dialog"
      aria-expanded={isOpen}
      aria-controls="cart-drawer"
      className="mobile-cart"
      aria-label={`Panier, ${count} article${count === 1 ? '' : 's'}`}
    >
      <span className="mobile-cart-icon">
        <CartIcon />
      </span>
      <span>Panier</span>
      {hydrated && count > 0 ? <b>{count > 99 ? '99+' : count}</b> : null}
    </button>
  );
}

export function BuyNowButton({
  product,
  quantity = 1
}: Readonly<{ product: CartProduct; quantity?: number }>) {
  const { add, lines, hydrated } = useCart();
  const router = useRouter();
  return (
    <button
      className="secondary-button buy-control"
      type="button"
      disabled={!hydrated || quantity < 1 || quantity > remainingQuantity(product, lines)}
      onClick={() => {
        add(product, quantity);
        router.push('/commande');
      }}
    >
      Acheter maintenant
    </button>
  );
}
