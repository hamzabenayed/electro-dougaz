import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import logo from '../../../../public/logo/logo-enhanced.png';
import { CartSummaryButton, MobileCartButton } from '../components/cart-controls';
import { apiRequest, type ApiProduct, type ApiCategory } from '../lib/api';
import { fromApiProduct } from '../lib/catalog';
import { CatalogCard } from '../components/catalog-card';
import { HeroPromotions } from '../components/hero-promotions';
import { selectHeroPromotions } from '../lib/hero-promotions';
export const dynamic = 'force-dynamic';
import { SiteFooter } from '../components/site-footer';

type IconName =
  | 'arrow'
  | 'cart'
  | 'grid'
  | 'headphones'
  | 'heart'
  | 'home'
  | 'laptop'
  | 'menu'
  | 'phone'
  | 'search'
  | 'shield'
  | 'spark'
  | 'truck'
  | 'tv'
  | 'washer';
interface Category {
  name: string;
  icon: IconName;
  color: string;
  count: string;
  slug: string;
}

const categoryStyles: Category[] = [
  {
    name: 'Smartphones',
    icon: 'phone',
    color: 'blue',
    count: 'Voir les produits',
    slug: 'smartphones'
  },
  {
    name: 'PC portables',
    icon: 'laptop',
    color: 'red',
    count: 'Voir les produits',
    slug: 'informatique'
  },
  { name: 'TV & image', icon: 'tv', color: 'violet', count: 'Voir les produits', slug: 'tv-image' },
  { name: 'Audio', icon: 'headphones', color: 'cyan', count: 'Voir les produits', slug: 'audio' },
  {
    name: 'Électroménager',
    icon: 'washer',
    color: 'orange',
    count: 'Voir les produits',
    slug: 'electromenager'
  }
];

function Icon({ name, size = 22 }: Readonly<{ name: IconName; size?: number }>) {
  const paths: Record<IconName, ReactNode> = {
    arrow: <path d="m5 12 14 0m-5-5 5 5-5 5" />,
    cart: <path d="M3 4h2l2.1 9.1a2 2 0 0 0 2 1.6h6.8a2 2 0 0 0 2-1.6L19 7H6m4 12h.01M17 19h.01" />,
    grid: <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />,
    headphones: (
      <path d="M4 14v-2a8 8 0 0 1 16 0v2M4 14h3v6H5a1 1 0 0 1-1-1zm16 0h-3v6h2a1 1 0 0 0 1-1z" />
    ),
    heart: (
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />
    ),
    home: <path d="m3 11 9-8 9 8v9a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" />,
    laptop: <path d="M5 5h14v10H5zM3 19h18M8 19l1-4m7 4-1-4" />,
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    phone: (
      <path d="M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm3 17h4" />
    ),
    search: <path d="m21 21-4.3-4.3m2.3-5.2A7.5 7.5 0 1 1 4 11.5a7.5 7.5 0 0 1 15 0Z" />,
    shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Zm-3-10 2 2 4-4" />,
    spark: <path d="m12 3 1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5z" />,
    truck: (
      <path d="M3 6h11v11H3zM14 10h4l3 3v4h-7zM7 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm10 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
    ),
    tv: <path d="M3 6h18v12H3zM8 22h8M9 2l3 4 3-4" />,
    washer: (
      <path d="M5 2h14a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm2 4h.01M11 6h6m1 9a6 6 0 1 1-12 0 6 6 0 0 1 12 0Z" />
    )
  };
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    >
      {paths[name]}
    </svg>
  );
}

function Brand() {
  return (
    <Link className="brand" href="/" aria-label="Electro Dougaz — Accueil">
      <span className="brand-mark">
        <Image alt="" height={40} priority sizes="80px" src={logo} width={80} />
      </span>
      <span className="brand-name">
        Electro <strong>Dougaz</strong>
      </span>
    </Link>
  );
}

export default async function HomePage() {
  const [records, categoryRecords, offers] = await Promise.all([
    apiRequest<ApiProduct[]>('/products?limit=8'),
    apiRequest<ApiCategory[]>('/categories'),
    apiRequest<ApiProduct[]>('/products?promotion=1&available=1&limit=100').catch(() => [])
  ]);
  const products = records.map(fromApiProduct);
  const heroOffers = selectHeroPromotions(offers.map(fromApiProduct));
  const categories = categoryRecords.map((category): Category => ({
    ...category,
    icon: categoryStyles.find((item) => item.slug === category.slug)?.icon ?? 'grid',
    color: 'blue',
    count: 'Voir les produits'
  }));
  return (
    <div className="site-shell">
      <div className="announcement">
        <div className="container announcement-inner">
          <p>
            <Icon name="truck" size={17} /> Livraison partout en Tunisie
          </p>
          <p className="announcement-note">Paiement sécurisé ou à la livraison</p>
          <Link href="/contact">
            Besoin d’aide ? <strong>Nous contacter</strong>
          </Link>
        </div>
      </div>
      <header className="site-header">
        <div className="container header-main">
          <Link
            className="icon-button mobile-menu"
            href="#categories"
            aria-label="Voir les catégories"
          >
            <Icon name="menu" />
          </Link>
          <Brand />
          <form className="search" role="search" action="/recherche" method="get">
            <Icon name="search" size={21} />
            <label className="sr-only" htmlFor="store-search">
              Rechercher un produit
            </label>
            <input id="store-search" name="q" type="search" placeholder="Que recherchez-vous ?" />
            <button type="submit">Rechercher</button>
          </form>
          <nav className="header-actions" aria-label="Actions personnelles">
            <CartSummaryButton className="cart-action" />
          </nav>
        </div>
        <div className="container mobile-search-wrap">
          <form className="search mobile-search" role="search" action="/recherche" method="get">
            <Icon name="search" size={20} />
            <label className="sr-only" htmlFor="mobile-store-search">
              Rechercher un produit
            </label>
            <input
              id="mobile-store-search"
              name="q"
              type="search"
              placeholder="Rechercher un produit..."
            />
            <button type="submit" aria-label="Lancer la recherche">
              <Icon name="arrow" size={20} />
            </button>
          </form>
        </div>
        <nav className="category-nav" aria-label="Catégories principales">
          <div className="container category-nav-inner">
            <Link className="all-categories" href="#categories">
              <Icon name="grid" size={19} /> Toutes les catégories
            </Link>
            <Link href="/categories/smartphones">Téléphones</Link>
            <Link href="/categories/informatique">Informatique</Link>
            <Link href="/categories/tv-image">TV & Image</Link>
            <Link href="/categories/electromenager">Électroménager</Link>
            <Link href="/categories/gaming">Gaming</Link>
            <Link className="deals-link" href="/promotions">
              <Icon name="spark" size={17} /> Bons plans
            </Link>
          </div>
        </nav>
      </header>
      <main>
        <section className="hero-section">
          <div className="container hero-grid">
            <div className="hero-copy">
              <span className="hero-kicker">
                <Icon name="spark" size={17} /> La technologie, simplement
              </span>
              <h1>
                Trouvez. Comparez.
                <br />
                <em>Achetez sereinement.</em>
              </h1>
              <p>
                Les meilleurs équipements électroniques, des prix clairs et une livraison rapide
                partout en Tunisie.
              </p>
              <div className="hero-actions">
                <Link className="primary-button" href={offers.length ? '#promotions' : '#produits'}>
                  Découvrir les offres <Icon name="arrow" size={20} />
                </Link>
                <Link className="secondary-button" href="#categories">
                  Voir les catégories
                </Link>
              </div>
              <div className="hero-proof">
                <span>
                  <Icon name="shield" size={19} /> Garantie officielle
                </span>
                <span>
                  <Icon name="truck" size={19} /> Livraison suivie
                </span>
              </div>
            </div>
            {heroOffers.length ? (
              <HeroPromotions products={heroOffers} />
            ) : (
              <div className="hero-showcase" aria-label="Offre vedette">
                <div className="showcase-orbit orbit-one" />
                <div className="showcase-orbit orbit-two" />
                <div className="showcase-product">
                  <Icon name="laptop" size={168} />
                </div>
                <div className="showcase-card price-card">
                  <small>À partir de</small>
                  <strong>Votre sélection</strong>
                </div>
                <div className="showcase-card delivery-card">
                  <Icon name="truck" size={23} />
                  <span>
                    <strong>Livraison suivie</strong>
                    <small>partout en Tunisie</small>
                  </span>
                </div>
                <span className="showcase-badge">Nouveauté</span>
              </div>
            )}
          </div>
        </section>
        <section className="benefits" aria-label="Nos engagements">
          <div className="container benefits-grid">
            <div>
              <span className="benefit-icon">
                <Icon name="truck" />
              </span>
              <p>
                <strong>Livraison nationale</strong>
                <small>Rapide et suivie</small>
              </p>
            </div>
            <div>
              <span className="benefit-icon">
                <Icon name="shield" />
              </span>
              <p>
                <strong>Paiement sécurisé</strong>
                <small>En ligne ou à la livraison</small>
              </p>
            </div>
            <div>
              <span className="benefit-icon">
                <Icon name="spark" />
              </span>
              <p>
                <strong>Produits garantis</strong>
                <small>Origine contrôlée</small>
              </p>
            </div>
            <div>
              <span className="benefit-icon">
                <Icon name="headphones" />
              </span>
              <p>
                <strong>Service disponible</strong>
                <small>Conseil avant et après achat</small>
              </p>
            </div>
          </div>
        </section>
        <section className="section container" id="categories">
          <div className="section-heading">
            <div>
              <p className="section-kicker">Accès rapide</p>
              <h2>Achetez par catégorie</h2>
            </div>
            <Link href="#categories">
              Toutes les catégories <Icon name="arrow" size={19} />
            </Link>
          </div>
          <div className="category-grid">
            {categories.map((category) => (
              <Link
                className="category-card"
                href={`/categories/${category.slug}`}
                key={category.name}
              >
                <span className={`category-icon tone-${category.color}`}>
                  <Icon name={category.icon} size={42} />
                </span>
                <span>
                  <strong>{category.name}</strong>
                  <small>{category.count}</small>
                </span>
                <Icon name="arrow" size={19} />
              </Link>
            ))}
          </div>
        </section>
        {offers.length > 0 && (
          <section className="section products-section offers-section" id="promotions">
            <div className="container offers-panel">
              <div className="offers-heading">
                <div>
                  <p className="section-kicker">Promotions</p>
                  <h2>Les offres du moment</h2>
                  <p>Des économies réelles sur vos produits préférés.</p>
                </div>
                <Link href="/promotions">Toutes les promotions →</Link>
              </div>
              <div className="product-grid">
                {offers.slice(0, 4).map((p) => (
                  <CatalogCard key={p.id} product={fromApiProduct(p)} />
                ))}
              </div>
            </div>
          </section>
        )}
        <section className="section products-section" id="produits">
          <div className="container">
            <div className="section-heading">
              <div>
                <p className="section-kicker red">Offres du moment</p>
                <h2>Les bons plans à saisir</h2>
              </div>
              <p className="offer-note">Offres valables dans la limite des stocks</p>
            </div>
            {!products.length ? (
              <p className="empty-state">Aucun produit publié pour le moment.</p>
            ) : null}
            <div className="product-grid">
              {products.map((product) => (
                <CatalogCard key={product.name} product={product} />
              ))}
            </div>
            <Link className="mobile-all-products" href="/recherche">
              Voir tous les produits <Icon name="arrow" size={19} />
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
      <nav className="mobile-bottom-nav" aria-label="Navigation mobile">
        <Link className="active" href="/">
          <Icon name="home" />
          <span>Accueil</span>
        </Link>
        <Link href="#categories">
          <Icon name="grid" />
          <span>Catégories</span>
        </Link>
        <Link href="/suivi-commande">
          <Icon name="truck" />
          <span>Suivi</span>
        </Link>
        <MobileCartButton />
      </nav>
    </div>
  );
}
