import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, beforeEach, vi } from 'vitest';
import { CartProvider } from '../components/cart-context';
import HomePage from './page';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) =>
      Promise.resolve(
        new Response(
          JSON.stringify(
            url.endsWith('/categories')
              ? [{ id: 'cat', name: 'Smartphones', slug: 'smartphones' }]
              : url.includes('promotion=1')
                ? []
                : Array.from({ length: 4 }, (_, index) => ({
                    id: 'p' + index,
                    slug: 'phone-' + index,
                    name: 'Phone ' + index,
                    description: 'Test',
                    category: { name: 'Smartphones', slug: 'smartphones' },
                    variant: {
                      id: 'v' + index,
                      sku: 'SKU' + index,
                      priceMillimes: 100000,
                      stockQuantity: 5
                    }
                  }))
          )
        )
      )
    )
  );
});
afterEach(() => vi.unstubAllGlobals());

async function renderHome() {
  const page = await HomePage();
  return render(<CartProvider>{page}</CartProvider>);
}

describe('HomePage', () => {
  it('identifies the storefront', async () => {
    await renderHome();
    expect(screen.getAllByRole('link', { name: /electro dougaz — accueil/i })).toHaveLength(2);
  });

  it('provides a search-first shopping path and accessible cart actions', async () => {
    await renderHome();
    expect(screen.getAllByRole('combobox')).toHaveLength(2);
    expect(screen.getByRole('link', { name: /découvrir les offres/i })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /ajouter .* au panier/i })).toHaveLength(4);
  });

  it('updates the accessible cart count when a product is added', async () => {
    await renderHome();
    const [firstAddButton] = screen.getAllByRole('button', { name: /ajouter .* au panier/i });
    if (!firstAddButton) throw new Error('Expected an add-to-cart button');
    fireEvent.click(firstAddButton);
    expect(screen.getAllByRole('button', { name: /panier, 1 article/i }).length).toBeGreaterThan(0);
  });
});
