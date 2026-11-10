import Image from 'next/image';
import Link from 'next/link';
import logo from '../../../../public/logo/logo-enhanced.png';
import { CartSummaryButton } from './cart-controls';
import { StoreSearch } from './store-search';

export function InnerHeader() {
  return (
    <header className="inner-header">
      <div className="container inner-header-row">
        <Link className="brand inner-brand" href="/" aria-label="Electro Dougaz — Accueil">
          <span className="inner-brand-mark">
            <Image alt="" height={38} priority sizes="76px" src={logo} width={76} />
          </span>
          <span className="brand-name">
            Electro <strong>Dougaz</strong>
          </span>
        </Link>
        <StoreSearch className="inner-search" />
        <CartSummaryButton className="cart-action" />
      </div>
      <nav className="container shop-quick-nav" aria-label="Navigation boutique">
        <Link href="/recherche">Catalogue</Link>
        <Link href="/promotions">✦ Promotions</Link>
        <Link href="/suivi-commande">Suivre ma commande</Link>
      </nav>
    </header>
  );
}
