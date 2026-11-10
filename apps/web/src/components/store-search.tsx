'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { apiRequest, formatMillimes, type ApiCategory, type ApiProduct } from '../lib/api';
import { ProductImage } from './product-image';
import { getPromotion } from '../lib/promotion';

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
type Suggestions = {
  query: string;
  categories: ApiCategory[];
  products: ApiProduct[];
  error?: boolean;
};

export function StoreSearch({
  className = 'search',
  compact = false
}: {
  className?: string;
  compact?: boolean;
}) {
  const id = useId();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [result, setResult] = useState<Suggestions | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const categories = useRef<ApiCategory[] | null>(null);
  const term = query.trim().slice(0, 100);
  const ready = result?.query === term;
  const href = `/recherche${term ? `?q=${encodeURIComponent(term)}` : ''}`;

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    let current = true;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const timer = setTimeout(
      () => {
        timeout = setTimeout(() => controller.abort(), 10000);
        void Promise.all([
          categories.current
            ? Promise.resolve(categories.current)
            : apiRequest<ApiCategory[]>('/categories', { signal: controller.signal }),
          term
            ? apiRequest<ApiProduct[]>(
                `/products?${new URLSearchParams({ q: term, limit: '6' })}`,
                { signal: controller.signal }
              )
            : Promise.resolve([] as ApiProduct[])
        ])
          .then(([categoryRecords, products]) => {
            if (!current) return;
            categories.current = categoryRecords.filter((category) => category.isVisible !== false);
            setActive(-1);
            setResult({
              query: term,
              categories: categories.current
                .filter((category) => normalize(category.name).includes(normalize(term)))
                .slice(0, 4),
              products
            });
          })
          .catch(() => {
            if (current) {
              setActive(-1);
              setResult({ query: term, categories: [], products: [], error: true });
            }
          })
          .finally(() => clearTimeout(timeout));
      },
      term ? 250 : 0
    );
    return () => {
      current = false;
      controller.abort();
      clearTimeout(timer);
      clearTimeout(timeout);
    };
  }, [term, open]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!form.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);

  const matches = ready ? result : null;
  const options = [
    ...(matches?.categories ?? []).map((category) => ({
      key: `category-${category.id}`,
      href: `/categories/${category.slug}`,
      label: category.name,
      category: true,
      product: undefined as ApiProduct | undefined
    })),
    ...(matches?.products ?? []).map((product) => ({
      key: product.id,
      href: `/produits/${product.slug}?option=${encodeURIComponent(product.variant.id)}`,
      label: product.name,
      category: false,
      product
    })),
    {
      key: 'all',
      href,
      label: term ? `Voir tous les résultats pour « ${term} »` : 'Explorer tout le catalogue',
      category: false,
      product: undefined
    },
    ...(!term
      ? [
          {
            key: 'offers',
            href: '/promotions',
            label: 'Découvrir les promotions',
            category: false,
            product: undefined
          }
        ]
      : [])
  ];
  return (
    <form
      ref={form}
      className={`${className} store-search`}
      role="search"
      action="/recherche"
      method="get"
      onSubmit={() => setOpen(false)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <svg
        aria-hidden="true"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 5 5" />
      </svg>
      <label className="sr-only" htmlFor={id}>
        Rechercher un produit
      </label>
      <input
        id={id}
        name="q"
        type="search"
        role="combobox"
        autoComplete="off"
        maxLength={100}
        placeholder={compact ? 'Rechercher un produit…' : 'Produit, catégorie, référence…'}
        value={query}
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        aria-activedescendant={open && active >= 0 ? `${id}-option-${active}` : undefined}
        onFocus={() => {
          setOpen(true);
          setActive(-1);
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === 'Escape') {
            event.preventDefault();
            setOpen(false);
            setActive(-1);
          }
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setOpen(true);
            const next =
              event.key === 'ArrowDown'
                ? (active + 1) % options.length
                : active <= 0
                  ? options.length - 1
                  : active - 1;
            setActive(next);
            document.getElementById(`${id}-option-${next}`)?.scrollIntoView({ block: 'nearest' });
          }
          if (event.key === 'Enter' && open && active >= 0) {
            const selected = document.getElementById(`${id}-option-${active}`);
            if (selected) {
              event.preventDefault();
              selected.click();
            }
          }
        }}
      />
      <button type="submit" aria-label="Lancer la recherche">
        {compact ? <span aria-hidden="true">→</span> : 'Rechercher'}
      </button>
      {open && (
        <div className="search-suggestions">
          <div className="search-suggestions-title">
            {term ? 'Suggestions de recherche' : 'Que souhaitez-vous découvrir ?'}
          </div>
          <p className="search-feedback" role="status" aria-live="polite">
            {!ready
              ? 'Recherche en cours…'
              : matches?.error
                ? 'Suggestions indisponibles. Vous pouvez lancer la recherche.'
                : !term
                  ? 'Explorez les catégories ou saisissez un produit.'
                  : !matches?.products.length && !matches?.categories.length
                    ? 'Aucun résultat. Essayez un autre nom ou une référence.'
                    : `${matches?.products.length ?? 0} produit(s) et ${matches?.categories.length ?? 0} catégorie(s) suggérés.`}
          </p>
          <div id={`${id}-list`} role="listbox" aria-label="Suggestions" className="search-options">
            {options.map((option, index) => {
              const product = option.product;
              const promotion =
                product &&
                getPromotion(
                  product.variant.priceMillimes / 1000,
                  (product.variant.compareAtPriceMillimes ?? 0) / 1000
                );
              return (
                <a
                  key={option.key}
                  id={`${id}-option-${index}`}
                  role="option"
                  aria-selected={active === index}
                  tabIndex={-1}
                  href={option.href}
                  className={`search-option${product ? ' is-product' : ''}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => setOpen(false)}
                >
                  {product ? (
                    <span className="search-option-image">
                      <ProductImage slug={product.slug} name="" imageId={product.images?.[0]?.id} />
                    </span>
                  ) : (
                    <span className="search-option-icon" aria-hidden="true">
                      {option.category ? '▦' : '→'}
                    </span>
                  )}
                  <span className="search-option-copy">
                    <strong>{option.label}</strong>
                    {option.category && <small>Catégorie</small>}
                    {product && (
                      <>
                        <small>
                          {product.category.name} ·{' '}
                          {product.variant.stockQuantity > 0 ? 'Disponible' : 'Rupture de stock'}
                        </small>
                        <span className="search-option-price">
                          {promotion && (
                            <del>{formatMillimes(product.variant.compareAtPriceMillimes!)} DT</del>
                          )}{' '}
                          <b>{formatMillimes(product.variant.priceMillimes)} DT</b>{' '}
                          {promotion && <em>{promotion.label}</em>}
                        </span>
                      </>
                    )}
                  </span>
                </a>
              );
            })}
          </div>
          <p className="search-keyboard-hint">
            ↑ ↓ pour parcourir · Entrée pour choisir · Échap pour fermer
          </p>
        </div>
      )}
    </form>
  );
}
