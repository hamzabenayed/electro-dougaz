import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CatalogCard } from './catalog-card';
import { ProductAvailability } from './product-availability';
import { CartProvider } from './cart-context';
import { catalogProducts } from '../lib/catalog';

afterEach(() => {
  cleanup();
  localStorage.clear();
});
describe('Public product availability', () => {
  it.each([true, false])('shows a clear status without an inventory count (%s)', (available) => {
    const { container } = render(<ProductAvailability available={available} />);
    expect(container.textContent).toBe(available ? 'Disponible' : 'Rupture de stock');
  });
  it('shows the available badge on product cards without exposing the stock count', () => {
    render(
      <CartProvider>
        <CatalogCard product={{ ...catalogProducts[0]!, stock: 37 }} />
      </CartProvider>
    );
    expect(screen.getByText('Disponible')).toBeTruthy();
    expect(screen.queryByText(/37 en stock/)).toBeNull();
  });
  it('keeps sold-out products visible and prevents adding them to the cart', () => {
    render(
      <CartProvider>
        <CatalogCard product={{ ...catalogProducts[0]!, stock: 0 }} />
      </CartProvider>
    );
    expect(screen.getByText('Rupture de stock')).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>('button').disabled).toBe(true);
  });
});
