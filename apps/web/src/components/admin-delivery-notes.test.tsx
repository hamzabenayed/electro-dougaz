import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminDeliveryNotes } from './admin-delivery-notes';
import { OrderDocument, type DeliveryOrder } from './order-document';

vi.mock('next/image', () => ({
  default: ({ alt, onLoad }: { alt: string; onLoad?: () => void }) => (
    <img alt={alt} onLoad={onLoad} src="/test-logo.png" />
  )
}));
const order: DeliveryOrder = {
  id: 'order',
  reference: 'ED-TEST',
  createdAt: '2026-11-09T08:00:00Z',
  status: 'confirmed',
  paymentMethod: 'cash_on_delivery',
  paymentStatus: 'pending',
  subtotalMillimes: 100000,
  deliveryMillimes: 8000,
  totalMillimes: 108000,
  customer: {
    firstName: 'Test',
    lastName: 'Client',
    phone: '22000148',
    address: '10 rue de test',
    governorate: 'Tunis'
  },
  items: [
    {
      id: 'line',
      productName: 'Téléphone',
      sku: 'SKU-001',
      quantity: 1,
      unitPriceMillimes: 100000,
      lineTotalMillimes: 100000
    }
  ],
  collectedMillimes: 8000,
  refundedMillimes: 0
};
beforeEach(() => {
  sessionStorage.setItem('electro-dougaz-admin-token', 'test-token');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([order]))));
});
afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.unstubAllGlobals();
});
describe('Delivery note safeguards', () => {
  it('waits for authenticated data and the logo before enabling printing', async () => {
    render(
      <AdminDeliveryNotes selected={['order']} from="" to="" status="" clearSelection={() => {}} />
    );
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Préparer la période' }).disabled
    ).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /Préparer la sélection/ }));
    const print = await screen.findByRole<HTMLButtonElement>('button', {
      name: 'Imprimer / Enregistrer les bons en PDF'
    });
    expect(print.disabled).toBe(true);
    fireEvent.load(screen.getByAltText('Electro Dougaz'));
    expect(print.disabled).toBe(false);
    const call = vi.mocked(fetch).mock.calls[0];
    expect(new Headers(call?.[1]?.headers).get('Authorization')).toBe('Bearer test-token');
    expect(JSON.parse(call?.[1]?.body as string)).toEqual({ mode: 'selection', ids: ['order'] });
  });
  it('does not show an empty or failed batch as a printable document', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Réduisez la période' }), { status: 400 })
    );
    render(
      <AdminDeliveryNotes
        selected={[]}
        from="2026-11-01"
        to="2026-11-09"
        status="confirmed"
        clearSelection={() => {}}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Préparer la période' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Réduisez la période');
    expect(
      screen.queryByRole('button', { name: 'Imprimer / Enregistrer les bons en PDF' })
    ).toBeNull();
    vi.mocked(fetch).mockResolvedValueOnce(new Response('[]'));
    fireEvent.click(screen.getByRole('button', { name: 'Préparer la période' }));
    await screen.findByText('Aucune commande pour cette période et ce statut.');
    expect(
      screen.queryByRole('button', { name: 'Imprimer / Enregistrer les bons en PDF' })
    ).toBeNull();
  });
  it.each(['cancelled', 'returned'])(
    'never asks the courier to collect money for %s orders',
    (status) => {
      render(<OrderDocument order={{ ...order, status }} collected={8000} />);
      expect(screen.getByText('Ne pas encaisser')).toBeTruthy();
      expect(screen.queryByText('Reste à collecter')).toBeNull();
      expect(screen.getByText('SKU-001')).toBeTruthy();
    }
  );
  it('shows the remaining cash balance and keeps the non-fiscal disclaimer', () => {
    render(<OrderDocument order={order} collected={8000} />);
    const balance = screen.getByText('Reste à collecter').parentElement;
    expect(balance?.textContent).toContain('100,000 DT');
    expect(screen.getByText(/ne constitue pas une facture fiscale/)).toBeTruthy();
  });
});
