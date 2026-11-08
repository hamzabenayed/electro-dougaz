import Image from 'next/image';
import Link from 'next/link';
import logo from '../../../../public/logo/logo-enhanced.png';

export function SiteFooter() {
  return (
    <>
      <footer className="site-footer">
        <div className="container footer-grid">
          <div className="footer-brand">
            <Link className="footer-logo" href="/" aria-label="Electro Dougaz — Accueil">
              <span>
                <Image alt="" src={logo} width={86} height={43} sizes="86px" />
              </span>
              <strong>
                Electro <em>Dougaz</em>
                <small>La technologie, simplement</small>
              </strong>
            </Link>
            <p>Équipements électroniques, prix clairs et livraison partout en Tunisie.</p>
            <div className="footer-trust">
              <span>Paiement sécurisé</span>
              <span>Livraison nationale</span>
            </div>
          </div>
          <div>
            <h2>Acheter</h2>
            <Link href="/categories/smartphones">Smartphones</Link>
            <Link href="/categories/informatique">Informatique</Link>
            <Link href="/categories/tv-image">TV & image</Link>
            <Link href="/recherche">Tous les produits</Link>
            <Link href="/promotions">Promotions</Link>
          </div>
          <div>
            <h2>Aide</h2>
            <Link href="/livraison">Livraison et paiement</Link>
            <Link href="/retours">Retours et garantie</Link>
            <Link href="/suivi-commande">Suivre ma commande</Link>
            <Link href="/contact">Contact</Link>
          </div>
          <div>
            <h2>Informations</h2>
            <Link href="/conditions">Conditions de vente</Link>
            <Link href="/confidentialite">Confidentialité</Link>
            <Link href="/mentions-legales">Mentions légales</Link>
          </div>
        </div>
        <div className="container footer-bottom">
          <span>© 2026 Electro Dougaz · Tous droits réservés</span>
          <span className="footer-payments">
            <b>ClicToPay — bientôt disponible</b>
            <b>Paiement à la livraison</b>
          </span>
        </div>
      </footer>
    </>
  );
}
