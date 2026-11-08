import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CartProvider } from './cart-context';
import { InnerHeader } from './inner-header';
import { SiteFooter } from './site-footer';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('storefront chrome', () => {
  it('renders an empty cart without a misleading zero badge', () => {
    const { container } = render(
      <CartProvider>
        <InnerHeader />
      </CartProvider>
    );
    expect(screen.getByRole('button', { name: /panier, 0 articles/i })).toBeTruthy();
    expect(container.querySelector('.cart-action > b')).toBeNull();
    expect(container.querySelector('.cart-symbol svg')).toBeTruthy();
  });

  it('uses the complete brand treatment in the footer', () => {
    render(<SiteFooter />);
    expect(screen.getByRole('link', { name: /electro dougaz — accueil/i })).toBeTruthy();
    expect(screen.getByText(/la technologie, simplement/i)).toBeTruthy();
    expect(screen.getByText(/paiement sécurisé/i)).toBeTruthy();
    expect(screen.queryByText(/Besoin d’aide pour choisir/i)).toBeNull();
  });
});
