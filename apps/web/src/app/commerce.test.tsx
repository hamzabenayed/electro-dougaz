import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CartProvider } from '../components/cart-context';
import { AdminProductForm } from '../components/admin-product-form';
import CheckoutPage from './commande/page';
import TrackingPage from './suivi-commande/page';
import ProductPage from './produits/[slug]/page';
import CategoryPage from './categories/[slug]/page';
import { fromApiProduct } from '../lib/catalog';
import type { ApiProduct } from '../lib/api';

const navigation = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => navigation,
  notFound: () => {
    throw new Error('NOT_FOUND');
  }
}));
const product: ApiProduct = {
  id: '72d4b7ca-cf3e-4e9a-ad80-76b7f875fd0b',
  slug: 'phone-local',
  name: 'Phone Local',
  description: 'Téléphone pour le test',
  status: 'published',
  category: {
    id: '9916b02a-7f69-48b8-bb15-bc351255ab07',
    name: 'Smartphones',
    slug: 'smartphones'
  },
  variant: {
    id: 'a8f143f1-d4ca-410f-a258-822ac9c8171d',
    sku: 'LOCAL-1',
    name: 'Standard',
    priceMillimes: 999900,
    stockQuantity: 5,
    lowStockThreshold: 3
  }
};
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const quote = {
  items: [
    { variantId: product.variant.id, name: product.name, quantity: 2, unitPriceMillimes: 999900 }
  ],
  subtotalMillimes: 1999800,
  deliveryMillimes: 8000,
  totalMillimes: 2007800
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(response([])))
  );
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
});
afterEach(() => {
  cleanup();
  window.localStorage.clear();
  window.sessionStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
function renderCheckout() {
  window.localStorage.setItem(
    'electro-dougaz-cart-v2',
    JSON.stringify([{ ...fromApiProduct(product), quantity: 2 }])
  );
  render(
    <CartProvider>
      <CheckoutPage />
    </CartProvider>
  );
}
function fillCheckout() {
  fireEvent.change(screen.getByLabelText('Prénom'), { target: { value: 'Test' } });
  fireEvent.change(screen.getByLabelText('Nom'), { target: { value: 'Client' } });
  fireEvent.change(screen.getByLabelText('Téléphone'), { target: { value: '22000148' } });
  fireEvent.change(screen.getByLabelText('Gouvernorat'), { target: { value: 'Tunis' } });
  fireEvent.change(screen.getByLabelText('Adresse'), { target: { value: '10 rue de test' } });
}

describe('Database-connected shopping screens', () => {
  it('renders API category products and local photos', async () => {
    vi.mocked(fetch).mockImplementation((url) =>
      Promise.resolve(
        response(
          (typeof url === 'string' ? url : url instanceof URL ? url.href : url.url).endsWith(
            '/categories'
          )
            ? [product.category]
            : [product]
        )
      )
    );
    const page = await CategoryPage({ params: Promise.resolve({ slug: 'smartphones' }) });
    render(<CartProvider>{page}</CartProvider>);
    expect(screen.getByRole('link', { name: 'Phone Local' }).getAttribute('href')).toBe(
      '/produits/phone-local'
    );
    expect(screen.getByRole('img', { name: 'Phone Local' }).getAttribute('src')).toBe(
      '/local-images/phone-local'
    );
  });
  it('renders the API product detail and disables purchase when sold out', async () => {
    vi.mocked(fetch).mockResolvedValue(
      response({ ...product, variant: { ...product.variant, stockQuantity: 0 } })
    );
    const page = await ProductPage({ params: Promise.resolve({ slug: product.slug }) });
    render(<CartProvider>{page}</CartProvider>);
    expect(screen.getByRole('heading', { name: product.name })).toBeTruthy();
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: /ajouter .* panier/i }).disabled
    ).toBe(true);
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: /acheter maintenant/i }).disabled
    ).toBe(true);
  });
  it('keeps the cart after a checkout error and reuses the retry key', async () => {
    vi.mocked(fetch).mockImplementation((url) =>
      Promise.resolve(
        (typeof url === 'string' ? url : url instanceof URL ? url.href : url.url).endsWith(
          '/orders/quote'
        )
          ? response(quote)
          : (typeof url === 'string' ? url : url instanceof URL ? url.href : url.url).endsWith(
                '/orders/options'
              )
            ? response({ deliveryMillimes: 8000 })
            : response({ message: 'Service indisponible' }, 503)
      )
    );
    renderCheckout();
    fillCheckout();
    await waitFor(() =>
      expect(
        screen.getByRole<HTMLButtonElement>('button', { name: /confirmer la commande/i }).disabled
      ).toBe(false)
    );
    fireEvent.click(screen.getByRole('button', { name: /confirmer la commande/i }));
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Service indisponible');
    expect(JSON.parse(window.localStorage.getItem('electro-dougaz-cart-v2') ?? '[]')).toHaveLength(
      1
    );
    fireEvent.click(screen.getByRole('button', { name: /confirmer la commande/i }));
    await waitFor(() => expect(vi.mocked(fetch).mock.calls).toHaveLength(4));
    const first = vi.mocked(fetch).mock.calls[2]?.[1];
    const second = vi.mocked(fetch).mock.calls[3]?.[1];
    expect(first?.headers).toEqual(second?.headers);
    if (typeof first?.body !== 'string') throw new Error('Expected JSON');
    expect(JSON.parse(first.body)).toMatchObject({
      paymentMethod: 'cash_on_delivery',
      items: [{ variantId: product.variant.id, quantity: 2 }]
    });
    expect(JSON.parse(first.body)).not.toHaveProperty('totalMillimes');
  });
  it('displays the real reference and clears the cart only after confirmation', async () => {
    vi.mocked(fetch).mockImplementation((url) =>
      Promise.resolve(
        (typeof url === 'string' ? url : url instanceof URL ? url.href : url.url).endsWith(
          '/orders/quote'
        )
          ? response(quote)
          : (typeof url === 'string' ? url : url instanceof URL ? url.href : url.url).endsWith(
                '/orders/options'
              )
            ? response({ deliveryMillimes: 8000 })
            : response({ reference: 'ED-TEST-123', totalMillimes: 2007800 }, 201)
      )
    );
    renderCheckout();
    fillCheckout();
    await waitFor(() =>
      expect(
        screen.getByRole<HTMLButtonElement>('button', { name: /confirmer la commande/i }).disabled
      ).toBe(false)
    );
    fireEvent.click(screen.getByRole('button', { name: /confirmer la commande/i }));
    expect(await screen.findByDisplayValue('ED-TEST-123')).toBeTruthy();
    await waitFor(() =>
      expect(JSON.parse(window.localStorage.getItem('electro-dougaz-cart-v2') ?? '[]')).toEqual([])
    );
  });
  it('shows the real tracking status', async () => {
    vi.mocked(fetch).mockResolvedValue(
      response({ reference: 'ED-TEST-123', status: 'shipped' }, 201)
    );
    render(
      <CartProvider>
        <TrackingPage />
      </CartProvider>
    );
    fireEvent.change(screen.getByLabelText(/référence de commande/i), {
      target: { value: 'ED-TEST-123' }
    });
    fireEvent.change(screen.getByLabelText(/numéro de téléphone/i), {
      target: { value: '22000148' }
    });
    const form = screen.getByLabelText(/référence de commande/i).closest('form');
    if (!form) throw new Error('Expected tracking form');
    fireEvent.submit(form);
    expect(await screen.findByText('Expédiée', { selector: '.tracking-status' })).toBeTruthy();
  });
  it('edits the chosen product with PUT instead of creating another product', async () => {
    window.sessionStorage.setItem('electro-dougaz-admin-token', 'test-token');
    vi.mocked(fetch).mockImplementation((url, init) =>
      Promise.resolve(
        response(
          (typeof url === 'string' ? url : url instanceof URL ? url.href : url.url).endsWith(
            '/categories'
          )
            ? [product.category]
            : init?.method === 'PUT'
              ? { id: product.id }
              : []
        )
      )
    );
    render(<AdminProductForm mode="edit" product={product} />);
    await screen.findByRole('option', { name: 'Smartphones' });
    expect(screen.getByLabelText<HTMLInputElement>(/nom du produit/i).value).toBe(product.name);
    fireEvent.click(screen.getByRole('button', { name: /enregistrer les modifications/i }));
    await waitFor(() => expect(navigation.push).toHaveBeenCalled());
    const request = vi.mocked(fetch).mock.calls.find(([, init]) => init?.method === 'PUT');
    expect(request?.[0]).toContain('/admin/products/' + product.id);
    expect(request?.[1]?.method).toBe('PUT');
  });
});
