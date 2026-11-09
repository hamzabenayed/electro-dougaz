'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { CatalogProduct } from '../lib/catalog';
import { ProductImage } from './product-image';
import { ProductPrice, ProductPromotion } from './product-promotion';

export function HeroPromotions({ products }: { products: readonly CatalogProduct[] }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(preference.matches);
    const visibility = () => setHidden(document.hidden);
    update();
    visibility();
    preference.addEventListener('change', update);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      preference.removeEventListener('change', update);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);
  useEffect(() => {
    if (products.length < 2 || paused || hovered || focused || reducedMotion || hidden) return;
    const timer = window.setInterval(
      () => setActive((index) => (index + 1) % products.length),
      6000
    );
    return () => window.clearInterval(timer);
  }, [products.length, paused, hovered, focused, reducedMotion, hidden]);
  if (!products.length) return null;
  const product = products[active % products.length];
  if (!product) return null;
  const move = (offset: number) => {
    setPaused(true);
    setActive((index) => (index + offset + products.length) % products.length);
  };
  return (
    <section
      className="hero-offers"
      aria-label="Promotions à découvrir"
      aria-roledescription="carrousel"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
    >
      <div className="hero-offers-heading">
        <span>
          <span className="offer-status-dot" aria-hidden="true" /> La sélection en promotion
        </span>
        <span>
          {(active % products.length) + 1} / {products.length}
        </span>
      </div>
      <Link
        className="hero-offer"
        href={`/produits/${product.slug}?option=${encodeURIComponent(product.variantId ?? product.id)}`}
      >
        <div className="hero-offer-image">
          <span className="hero-offer-watermark" aria-hidden="true">
            BON PLAN
          </span>
          <div className="hero-offer-product" key={product.id}>
            <ProductImage slug={product.slug} name={product.name} imageId={product.imageId} eager />
          </div>
          <ProductPromotion price={product.price} oldPrice={product.oldPrice} />
          <span className="hero-offer-stock">
            <span aria-hidden="true">✓</span> Disponible
          </span>
        </div>
        <div className="hero-offer-details" key={product.id}>
          <span className="product-category">{product.category}</span>
          <h2>{product.name}</h2>
          <ProductPrice price={product.price} oldPrice={product.oldPrice} />
          <span className="hero-offer-cta">
            Découvrir cette offre <span aria-hidden="true">→</span>
          </span>
        </div>
      </Link>
      {products.length > 1 && (
        <div className="hero-offer-controls">
          <button type="button" aria-label="Offre précédente" onClick={() => move(-1)}>
            ←
          </button>
          <div className="hero-offer-dots">
            {products.map((item, index) => (
              <button
                type="button"
                key={item.id}
                aria-label={`Afficher l’offre ${index + 1} : ${item.name}`}
                aria-pressed={index === active % products.length}
                onClick={() => {
                  setActive(index);
                  setPaused(true);
                }}
              >
                <span />
              </button>
            ))}
          </div>
          {!reducedMotion && (
            <button
              type="button"
              aria-label={paused ? 'Reprendre le défilement' : 'Mettre en pause le défilement'}
              onClick={() => setPaused(!paused)}
            >
              {paused ? '▶' : 'Ⅱ'}
            </button>
          )}
          <button type="button" aria-label="Offre suivante" onClick={() => move(1)}>
            →
          </button>
        </div>
      )}
    </section>
  );
}
