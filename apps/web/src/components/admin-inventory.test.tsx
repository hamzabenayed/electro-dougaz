import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminInventory } from './admin-inventory';

const items = [
  {
    variantId: 'variant',
    productId: 'product',
    productName: 'Téléphone test',
    sku: 'TEL-001',
    stockQuantity: 4,
    lowStockThreshold: 5,
    isLow: true
  }
];
beforeEach(() => {
  sessionStorage.setItem('electro-dougaz-admin-token', 'test');
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) =>
      Promise.resolve(
        new Response(
          JSON.stringify(
            init?.method === 'PATCH'
              ? { variantId: 'variant', stockQuantity: 7 }
              : url.includes('/history')
                ? []
                : items
          )
        )
      )
    )
  );
});
afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.unstubAllGlobals();
});
async function selectProduct() {
  render(<AdminInventory />);
  fireEvent.change(await screen.findByLabelText('Produit à modifier'), {
    target: { value: 'variant' }
  });
}
describe('Guided stock adjustments', () => {
  it('adds units with a clear recorded reason and updates from the server response', async () => {
    await selectProduct();
    fireEvent.change(screen.getByLabelText(/Nombre d’unités/), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Pourquoi modifiez-vous le stock ?'), {
      target: { value: 'Livraison fournisseur reçue' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le changement' }));
    await screen.findByText(/Stock disponible : 7/);
    const request = vi.mocked(fetch).mock.calls.find(([, init]) => init?.method === 'PATCH')?.[1];
    if (typeof request?.body !== 'string') throw new Error('Expected JSON body');
    expect(JSON.parse(request.body)).toMatchObject({
      variantId: 'variant',
      quantity: 3,
      note: 'Livraison fournisseur reçue'
    });
    expect(vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === 'PATCH')).toHaveLength(
      1
    );
    expect(screen.getByLabelText<HTMLInputElement>(/Nombre d’unités/).value).toBe('');
  });
  it('sends a negative delta for removal without asking the user to enter a minus sign', async () => {
    await selectProduct();
    fireEvent.click(screen.getByRole('button', { name: /Retirer du stock/ }));
    fireEvent.change(screen.getByLabelText(/Nombre d’unités/), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Pourquoi modifiez-vous le stock ?'), {
      target: { value: 'Perte constatée' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le changement' }));
    await screen.findByText(/retirée/);
    const body = vi
      .mocked(fetch)
      .mock.calls.find(([, init]) => init?.method === 'PATCH')?.[1]?.body;
    if (typeof body !== 'string') throw new Error('Expected JSON body');
    expect(JSON.parse(body)).toMatchObject({ quantity: -2 });
  });
  it('prevents over-removal and requires an explanation for other reasons', async () => {
    await selectProduct();
    fireEvent.click(screen.getByRole('button', { name: /Retirer du stock/ }));
    fireEvent.change(screen.getByLabelText(/Nombre d’unités/), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText('Pourquoi modifiez-vous le stock ?'), {
      target: { value: 'Autre raison' }
    });
    const save = screen.getByRole<HTMLButtonElement>('button', {
      name: 'Enregistrer le changement'
    });
    expect(save.disabled).toBe(true);
    expect(screen.getByRole('alert').textContent).toContain('plus d’articles');
    fireEvent.change(screen.getByLabelText(/Nombre d’unités/), { target: { value: '1' } });
    expect(save.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/Précisions/), {
      target: { value: 'Inventaire physique vérifié' }
    });
    expect(save.disabled).toBe(false);
  });
  it('filters products without hiding the selected adjustment', async () => {
    await selectProduct();
    fireEvent.change(screen.getByLabelText('Rechercher un produit'), {
      target: { value: 'inexistant' }
    });
    expect(screen.getByText('Aucun résultat')).toBeTruthy();
    expect(screen.getByLabelText<HTMLSelectElement>('Produit à modifier').value).toBe('variant');
  });
  it('retains the draft when the server rejects an adjustment', async () => {
    await selectProduct();
    fireEvent.change(screen.getByLabelText(/Nombre d’unités/), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Pourquoi modifiez-vous le stock ?'), {
      target: { value: 'Livraison fournisseur reçue' }
    });
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Stock indisponible' }), { status: 409 })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le changement' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Stock indisponible');
    expect(screen.getByLabelText<HTMLInputElement>(/Nombre d’unités/).value).toBe('3');
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le changement' }));
    await screen.findByText(/Stock disponible : 7/);
    const attempts = vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === 'PATCH');
    expect(attempts).toHaveLength(2);
    expect(attempts[0]?.[1]?.body).toBe(attempts[1]?.[1]?.body);
  });
});
