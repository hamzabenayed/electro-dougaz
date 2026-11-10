import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { CatalogCard } from './catalog-card';
import { CartProvider } from './cart-context';
import { CartSummaryButton } from './cart-controls';
import { catalogProducts } from '../lib/catalog';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});
const product = catalogProducts[0]!;
it('shows real discounts and adds an available product to the cart', () => {
  const { container } = render(
    <CartProvider>
      <CatalogCard product={product} />
      <CartSummaryButton />
    </CartProvider>
  );
  expect(container.querySelector('.catalog-card.has-promotion')).toBeTruthy();
  expect(container.querySelector('del')).toBeTruthy();
  expect(screen.getByText('Disponible')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: `Ajouter ${product.name} au panier` }));
  expect(screen.getByRole('button', { name: 'Panier, 1 article' })).toBeTruthy();
});
it('does not invent a promotion and disables unavailable single-option products', () => {
  const { container } = render(
    <CartProvider>
      <CatalogCard product={{ ...product, oldPrice: undefined, stock: 0 }} />
    </CartProvider>
  );
  expect(container.querySelector('.product-promotion')).toBeNull();
  expect(container.querySelector('del')).toBeNull();
  expect(screen.getByText('Rupture de stock')).toBeTruthy();
  expect(screen.getByRole<HTMLButtonElement>('button', { name: /Indisponible/ }).disabled).toBe(
    true
  );
});
it('preserves option selection rather than adding an arbitrary variant', () => {
  const variant = { id: 'black', sku: 'BLACK', priceMillimes: 100000, stockQuantity: 2 };
  render(
    <CartProvider>
      <CatalogCard
        product={{ ...product, variantId: 'blue', variants: [variant, { ...variant, id: 'blue' }] }}
      />
    </CartProvider>
  );
  expect(screen.getByRole('link', { name: 'Choisir' }).getAttribute('href')).toContain(
    'option=blue'
  );
  expect(screen.queryByRole('button')).toBeNull();
});
