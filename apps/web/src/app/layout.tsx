import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { CartProvider } from '../components/cart-context';
import { CartDrawer } from '../components/cart-drawer';
import './styles.css';
import './admin.css';
import './cart-drawer.css';
import './storefront-features.css';
import './commerce-enhancements.css';
import './promotion-showcase.css';

export const metadata: Metadata = {
  title: {
    default: 'Electro Dougaz',
    template: '%s | Electro Dougaz'
  },
  description: 'Electronics, delivered across Tunisia.'
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="fr">
      <body>
        <CartProvider>
          {children}
          <CartDrawer />
        </CartProvider>
      </body>
    </html>
  );
}
