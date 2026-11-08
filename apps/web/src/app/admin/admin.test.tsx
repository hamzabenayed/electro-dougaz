import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AdminLoginPage from './connexion/page';
import DashboardPage from './(workspace)/tableau-de-bord/page';
import { AdminProductForm } from '../../components/admin-product-form';
import { AdminOrderDetail } from '../../components/admin-orders';

const navigation = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => navigation }));

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify([
            { id: '9916b02a-7f69-48b8-bb15-bc351255ab07', name: 'Smartphones', slug: 'smartphones' }
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
    )
  );
});

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Admin experience', () => {
  it('shows a failed order request without leaving an endless loading indicator', async () => {
    window.sessionStorage.setItem('electro-dougaz-admin-token', 'test-token');
    vi.mocked(fetch).mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ message: 'Commande introuvable' }), { status: 404 })
      )
    );
    render(<AdminOrderDetail id="missing-order" />);
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryByText('Chargement de la commande…')).toBeNull();
  });
  it('provides an accessible professional login form', () => {
    render(<AdminLoginPage />);
    expect(screen.getByRole('heading', { name: /se connecter/i })).toBeTruthy();
    expect(screen.getByLabelText(/adresse e-mail/i)).toBeTruthy();
    expect(screen.getByLabelText(/^mot de passe$/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /accéder au tableau de bord/i })).toBeTruthy();
  });

  it('shows real empty orders instead of demo dashboard figures', async () => {
    window.sessionStorage.setItem('electro-dougaz-admin-token', 'test-token');
    vi.mocked(fetch).mockImplementation(() => Promise.resolve(new Response('[]')));
    render(<DashboardPage />);
    expect(await screen.findByText('Aucune commande pour le moment.')).toBeTruthy();
    expect(screen.getByRole('heading', { name: /stock faible/i })).toBeTruthy();
  });

  it('accepts the supported product image formats, including JFIF', () => {
    render(<AdminProductForm />);
    const input = screen.getByLabelText<HTMLInputElement>(/ajouter des photos/i);
    expect(input.accept).toBe('image/jpeg,.jpg,.jpeg,.jfif,image/png,.png,image/webp,.webp');
  });

  it('previews a selected image and lets the user remove it', () => {
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:product-preview')
    });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    render(<AdminProductForm />);
    const input = screen.getByLabelText(/ajouter des photos/i);
    const file = new File(['image-data'], 'telephone.jfif', { type: 'image/jpeg' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(screen.getByRole('img', { name: /aperçu de telephone\.jfif/i })).toBeTruthy();
    expect(screen.getByText(/^image principale$/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /supprimer telephone\.jfif/i }));
    expect(screen.queryByRole('img', { name: /telephone\.jfif/i })).toBeNull();
  });

  it('persists a new product through the authenticated API', async () => {
    window.sessionStorage.setItem('electro-dougaz-admin-token', 'test-token');
    const fetchMock = vi.mocked(fetch);
    render(<AdminProductForm />);
    await screen.findByRole('option', { name: 'Smartphones' });
    fireEvent.change(screen.getByLabelText(/nom du produit/i), {
      target: { value: 'Téléphone Test' }
    });
    fireEvent.change(screen.getByLabelText(/catégorie/i), {
      target: { value: '9916b02a-7f69-48b8-bb15-bc351255ab07' }
    });
    fireEvent.change(screen.getByLabelText(/référence interne/i), {
      target: { value: 'TEL-TEST-1' }
    });
    fireEvent.change(screen.getByLabelText(/^description/i), {
      target: { value: 'Produit de validation.' }
    });
    fireEvent.change(screen.getByLabelText(/prix de vente/i), { target: { value: '999.900' } });
    fireEvent.click(screen.getByRole('button', { name: /créer le produit/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const request = fetchMock.mock.calls[1]?.[1];
    expect(request?.method).toBe('POST');
    expect(request?.headers).toMatchObject({ Authorization: 'Bearer test-token' });
    if (typeof request?.body !== 'string') throw new Error('Expected a JSON request body');
    expect(JSON.parse(request.body)).toMatchObject({
      name: 'Téléphone Test',
      slug: 'telephone-test',
      priceMillimes: 999900
    });
  });
});
