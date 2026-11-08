import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProductDetail } from './product-detail';
import { CartProvider, useCart, restoreCart } from './cart-context';
import { fromApiProduct } from '../lib/catalog';
import { validateCheckout, governorates } from '../lib/checkout-validation';
import { OrderTimeline } from './order-timeline';
import { AdminProductOptions } from './admin-product-options';
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
afterEach(() => {
  cleanup();
  localStorage.clear();
});
const base = {
  id: 'black',
  sku: 'BLACK',
  name: 'Noir 128 Go',
  priceMillimes: 800000,
  compareAtPriceMillimes: 1000000,
  stockQuantity: 4
};
const product = fromApiProduct({
  id: 'phone',
  slug: 'phone',
  name: 'Phone',
  description: 'Test',
  category: { name: 'Phones', slug: 'phones' },
  variant: base,
  variants: [
    base,
    { id: 'blue', sku: 'BLUE', name: 'Bleu 256 Go', priceMillimes: 1200000, stockQuantity: 3 },
    { id: 'red', sku: 'RED', name: 'Rouge', priceMillimes: 1000000, stockQuantity: 0 }
  ],
  images: [
    { id: 'one', alt: 'Face' },
    { id: 'two', alt: 'Dos' }
  ]
});
function CartProbe() {
  const { lines } = useCart();
  return <output data-testid="cart">{JSON.stringify(lines)}</output>;
}
describe('Shopping features', () => {
  it('migrates legacy cart identifiers and merges duplicate variant lines safely', () => {
    const line = {
      id: 'old-product-id',
      variantId: 'variant',
      slug: 'phone',
      name: 'Phone',
      price: 10,
      quantity: 2,
      stock: 5
    };
    expect(restoreCart([line, { ...line, id: 'variant', quantity: 1 }])).toEqual([
      { ...line, id: 'variant', quantity: 3 }
    ]);
    expect(restoreCart([{ ...line, price: 'bad' }, null, { ...line, quantity: -1 }])).toEqual([]);
  });
  it('keeps options separate in the cart and updates price and availability', async () => {
    render(
      <CartProvider>
        <ProductDetail product={product} />
        <CartProbe />
      </CartProvider>
    );
    const add = screen.getByRole<HTMLButtonElement>('button', { name: /Ajouter .* au panier/ });
    await waitFor(() => expect(add.disabled).toBe(false));
    fireEvent.click(add);
    fireEvent.click(screen.getByRole('button', { name: /Bleu 256 Go/ }));
    fireEvent.click(screen.getByRole('button', { name: /Ajouter .* au panier/ }));
    const lines = JSON.parse(screen.getByTestId('cart').textContent ?? '[]') as Array<{
      id: string;
      price: number;
    }>;
    expect(lines.map((v) => v.id)).toEqual(['black', 'blue']);
    expect(lines.map((v) => v.price)).toEqual([800, 1200]);
    fireEvent.click(screen.getByRole('button', { name: /Rouge/ }));
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: /Ajouter .* au panier/ }).disabled
    ).toBe(true);
    expect(screen.queryByText(/4 en stock/)).toBeNull();
  });
  it('switches gallery photos with accessible controls', () => {
    render(
      <CartProvider>
        <ProductDetail product={product} />
      </CartProvider>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Photo 2' }));
    expect(screen.getByRole('button', { name: 'Photo 2' }).getAttribute('aria-pressed')).toBe(
      'true'
    );
    expect(screen.getAllByAltText('Dos')[0]?.getAttribute('src')).toContain('/media/two');
  });
  it('provides all 24 governorates and field-level validation', () => {
    expect(governorates).toHaveLength(24);
    const data = new FormData();
    expect(Object.keys(validateCheckout(data))).toHaveLength(5);
    for (const [key, value] of Object.entries({
      firstName: 'Amira',
      lastName: 'Client',
      phone: '22000148',
      governorate: 'Tunis',
      address: '10 rue Test'
    }))
      data.set(key, value);
    expect(validateCheckout(data)).toEqual({});
    data.set('firstName', '  ');
    expect(validateCheckout(data).firstName).toBeTruthy();
  });
  it('does not show a misleading completed timeline for a cancelled order', () => {
    render(<OrderTimeline result={{ reference: 'ED-TEST', status: 'cancelled' }} />);
    expect(screen.getByText('Annulée')).toBeTruthy();
    expect(screen.queryByRole('list')).toBeNull();
  });
  it('allows the administrator to add and remove option combinations', () => {
    render(<AdminProductOptions />);
    fireEvent.click(screen.getByRole('button', { name: /Ajouter une option/ }));
    expect(screen.getByLabelText('Combinaison')).toBeTruthy();
    expect(screen.getByLabelText('Référence unique')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Retirer cette option' }));
    expect(screen.queryByLabelText('Combinaison')).toBeNull();
  });
});
