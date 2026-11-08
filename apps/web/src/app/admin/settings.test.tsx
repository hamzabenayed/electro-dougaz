import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SettingsPage from './(workspace)/parametres/page';

const settings = {
  phone: '',
  whatsapp: '',
  contactEmail: '',
  address: '',
  openingHours: '',
  deliveryMillimes: 8000,
  deliveryEstimate: '',
  notificationEmail: '',
  revision: 0
};
let role = 'owner';
beforeEach(() => {
  role = 'owner';
  sessionStorage.setItem('electro-dougaz-admin-token', 'test-token');
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) =>
      Promise.resolve(
        new Response(
          JSON.stringify(
            url.endsWith('/auth/me')
              ? { role }
              : init?.method === 'PUT'
                ? { ...JSON.parse(typeof init.body === 'string' ? init.body : '{}'), revision: 1 }
                : settings
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

describe('Store settings', () => {
  it('saves editable values and converts dinars into integer millimes', async () => {
    render(<SettingsPage />);
    fireEvent.change(await screen.findByLabelText(/Frais de livraison/), {
      target: { value: '12.345' }
    });
    fireEvent.change(screen.getByLabelText('E-mail de notification'), {
      target: { value: 'private@example.test' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer les modifications' }));
    await screen.findByText('Paramètres enregistrés');
    const call = vi.mocked(fetch).mock.calls.find(([, init]) => init?.method === 'PUT');
    const body = call?.[1]?.body;
    if (typeof body !== 'string') throw new Error('Expected JSON body');
    expect(JSON.parse(body)).toMatchObject({
      deliveryMillimes: 12345,
      notificationEmail: 'private@example.test',
      revision: 0
    });
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Enregistrer les modifications' })
        .disabled
    ).toBe(true);
  });
  it('discards local edits without writing to the API', async () => {
    render(<SettingsPage />);
    const input = await screen.findByLabelText<HTMLInputElement>('Téléphone');
    fireEvent.change(input, { target: { value: '+216 22000148' } });
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(input.value).toBe('');
    expect(vi.mocked(fetch).mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(false);
  });
  it('keeps staff read-only and does not request internal settings', async () => {
    role = 'fulfillment';
    render(<SettingsPage />);
    await screen.findByText('Lecture seule');
    expect(screen.queryByLabelText('E-mail de notification')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Enregistrer les modifications' })).toBeNull();
    expect(
      vi
        .mocked(fetch)
        .mock.calls.some(([url]) => typeof url === 'string' && url.endsWith('/admin/settings'))
    ).toBe(false);
    expect(screen.getByLabelText('Téléphone').closest('fieldset')?.disabled).toBe(true);
  });
  it('retains unsaved data on a conflicting update', async () => {
    render(<SettingsPage />);
    const input = await screen.findByLabelText<HTMLInputElement>('Téléphone');
    fireEvent.change(input, { target: { value: '+216 22000148' } });
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Rechargez la page avant de réessayer.' }), {
        status: 409
      })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer les modifications' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Rechargez'));
    expect(input.value).toBe('+216 22000148');
  });
});
