import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CartProvider, useCart } from './cart-context';
import { ProductPurchase } from './product-purchase';

const navigation = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => navigation }));
const phone = {
  id: 'phone',
  variantId: 'variant',
  slug: 'phone',
  name: 'Téléphone',
  price: 1299,
  stock: 4
};
function CartState() {
  const { lines, total } = useCart();
  return <output data-testid="cart">{JSON.stringify({ lines, total })}</output>;
}
function setup(stock = 4) {
  render(
    <CartProvider>
      <ProductPurchase product={{ ...phone, stock }} />
      <CartState />
    </CartProvider>
  );
}
beforeEach(() => vi.clearAllMocks());
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('Product quantity selection', () => {
  it('adds two units and calculates their total', () => {
    setup();
    fireEvent.change(screen.getByLabelText('Quantité'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: /ajouter .* panier/i }));
    expect(screen.getByTestId('cart').textContent).toContain('"quantity":2');
    expect(screen.getByTestId('cart').textContent).toContain('"total":2598');
  });
  it('buys the selected quantity immediately', () => {
    setup();
    fireEvent.change(screen.getByLabelText('Quantité'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: /acheter maintenant/i }));
    expect(screen.getByTestId('cart').textContent).toContain('"quantity":3');
    expect(navigation.push).toHaveBeenCalledWith('/commande');
  });
  it('accounts for existing cart quantities and stops at available stock', () => {
    window.localStorage.setItem(
      'electro-dougaz-cart-v2',
      JSON.stringify([{ ...phone, quantity: 2 }])
    );
    setup();
    expect(screen.getAllByRole('option')).toHaveLength(2);
    fireEvent.change(screen.getByLabelText('Quantité'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: /ajouter .* panier/i }));
    expect(screen.getByTestId('cart').textContent).toContain('"quantity":4');
    expect(screen.getByLabelText<HTMLSelectElement>('Quantité').disabled).toBe(true);
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: /acheter maintenant/i }).disabled
    ).toBe(true);
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: /ajouter .* panier/i }).disabled
    ).toBe(true);
  });
  it('limits selection to ten and disables sold-out products', () => {
    setup(20);
    expect(screen.getAllByRole('option')).toHaveLength(10);
    cleanup();
    setup(0);
    expect(screen.getByLabelText<HTMLSelectElement>('Quantité').disabled).toBe(true);
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: /ajouter .* panier/i }).disabled
    ).toBe(true);
  });
});
