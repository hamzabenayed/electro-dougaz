import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AdminProductForm } from './admin-product-form';
import type { ApiProduct } from '../lib/api';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
const product: ApiProduct = {
  id: 'test-product',
  name: 'Phone',
  slug: 'phone',
  description: 'Test phone',
  status: 'published',
  category: { id: 'category', name: 'Phones', slug: 'phones' },
  variant: {
    id: 'variant',
    name: 'Standard',
    sku: 'PHONE',
    priceMillimes: 800000,
    compareAtPriceMillimes: 1000000,
    stockQuantity: 5,
    lowStockThreshold: 3
  }
};
beforeEach(() => {
  sessionStorage.setItem('electro-dougaz-admin-token', 'test-token');
  vi.stubGlobal(
    'fetch',
    vi.fn((_url: RequestInfo | URL, init?: RequestInit) =>
      Promise.resolve(
        new Response(
          JSON.stringify(init?.method === 'PUT' ? { id: product.id } : [product.category])
        )
      )
    )
  );
});
afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
async function openForm() {
  const view = render(<AdminProductForm mode="edit" product={product} />);
  await screen.findByRole('option', { name: 'Phones' });
  return view.container.querySelector('form')!;
}
async function submittedBody() {
  await waitFor(() =>
    expect(vi.mocked(fetch).mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(true)
  );
  const call = vi.mocked(fetch).mock.calls.find(([, init]) => init?.method === 'PUT')!;
  const payload = call[1]?.body;
  if (typeof payload !== 'string') throw new Error('Expected JSON request body');
  return JSON.parse(payload) as { priceMillimes: number; compareAtPriceMillimes?: number };
}
it('loads an existing promotion, previews it and saves integer millime prices', async () => {
  const form = await openForm();
  expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('true');
  expect(screen.getByText('−20 %')).toBeTruthy();
  fireEvent.change(screen.getByLabelText(/Prix promotionnel/), { target: { value: '750.125' } });
  fireEvent.submit(form);
  expect(await submittedBody()).toMatchObject({
    priceMillimes: 750125,
    compareAtPriceMillimes: 1000000
  });
});
it('restores the original price and clears the comparison price when disabled', async () => {
  const form = await openForm();
  fireEvent.click(screen.getByRole('switch'));
  fireEvent.submit(form);
  const body = await submittedBody();
  expect(body.priceMillimes).toBe(1000000);
  expect(body.compareAtPriceMillimes).toBeUndefined();
});
it('rejects a promotion that is not below the original price', async () => {
  const form = await openForm();
  fireEvent.change(screen.getByLabelText(/Prix promotionnel/), { target: { value: '1000' } });
  fireEvent.submit(form);
  expect(screen.getByRole('alert').textContent).toContain('inférieur');
  expect(vi.mocked(fetch).mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(false);
});
it('uploads selected photos and retries an upload failure without creating a duplicate product', async () => {
  vi.stubGlobal(
    'URL',
    class extends URL {
      static override createObjectURL() {
        return 'blob:test-photo';
      }
      static override revokeObjectURL() {}
    }
  );
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
  let uploadAttempts = 0;
  vi.mocked(fetch).mockImplementation((_url, init) => {
    if (init?.method === 'POST') {
      uploadAttempts++;
      return Promise.resolve(
        new Response(
          JSON.stringify(uploadAttempts === 1 ? { message: 'Upload interrompu' } : { id: 'image' }),
          { status: uploadAttempts === 1 ? 503 : 201 }
        )
      );
    }
    return Promise.resolve(
      new Response(JSON.stringify(init?.method === 'PUT' ? { id: product.id } : [product.category]))
    );
  });
  const form = await openForm();
  fireEvent.change(screen.getByLabelText(/Ajouter des photos/), {
    target: { files: [new File(['photo'], 'phone.jfif', { type: 'image/jpeg' })] }
  });
  fireEvent.submit(form);
  expect((await screen.findByRole('alert')).textContent).toContain('Upload interrompu');
  fireEvent.submit(form);
  await waitFor(() => expect(uploadAttempts).toBe(2));
  expect(vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === 'PUT')).toHaveLength(2);
  expect(
    vi
      .mocked(fetch)
      .mock.calls.some(
        ([url, init]) =>
          typeof url === 'string' && url.endsWith('/admin/products') && init?.method === 'POST'
      )
  ).toBe(false);
});
