'use client';
import { useEffect, useState } from 'react';
import { apiRequest, type ApiProduct } from '../lib/api';
import { fromApiProduct, type CatalogProduct } from '../lib/catalog';
import { CatalogCard } from './catalog-card';
const key = 'electro-recent-products';
export function recentSlugs(value: unknown, current: string) {
  const previous = Array.isArray(value)
    ? value.filter(
        (x): x is string =>
          typeof x === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(x) && x.length <= 180
      )
    : [];
  return [...new Set([current, ...previous])].slice(0, 5);
}
export function RecentProducts({ slug }: { slug: string }) {
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  useEffect(() => {
    let active = true;
    let stored: unknown = [];
    try {
      stored = JSON.parse(localStorage.getItem(key) ?? '[]');
    } catch {
      /* Storage is optional. */
    }
    const slugs = recentSlugs(stored, slug);
    try {
      localStorage.setItem(key, JSON.stringify(slugs));
    } catch {
      /* Private browsing may block storage. */
    }
    void Promise.all(
      slugs
        .filter((s) => s !== slug)
        .map((s) =>
          apiRequest<ApiProduct>(`/products/${encodeURIComponent(s)}`)
            .then(fromApiProduct)
            .catch(() => null)
        )
    ).then((rows) => {
      if (active) setProducts(rows.filter((p): p is CatalogProduct => p !== null));
    });
    return () => {
      active = false;
    };
  }, [slug]);
  if (!products.length) return null;
  return (
    <section className="recent-products">
      <div className="offers-heading">
        <h2>Récemment consultés</h2>
        <button
          className="secondary-button"
          onClick={() => {
            try {
              localStorage.removeItem(key);
            } catch {
              /* Optional storage. */
            }
            setProducts([]);
          }}
        >
          Effacer l’historique
        </button>
      </div>
      <p>Sur cet appareil uniquement. Prix et disponibilité actualisés.</p>
      <div className="product-grid">
        {products.map((p) => (
          <CatalogCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}
