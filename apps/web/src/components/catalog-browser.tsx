import Link from 'next/link';
import { apiRequest, type ApiCategory, type ApiProduct } from '../lib/api';
import { fromApiProduct } from '../lib/catalog';
import { PageShell } from './page-shell';
import { CatalogCard } from './catalog-card';
export type CatalogParams = Record<string, string | string[] | undefined>;
export async function CatalogBrowser({
  params,
  promotions = false,
  category
}: {
  params: CatalogParams;
  promotions?: boolean;
  category?: string;
}) {
  const value = (key: string) => (typeof params[key] === 'string' ? params[key] : '');
  const query = new URLSearchParams({
    limit: '24',
    offset: String((Math.max(1, Math.min(10000, Math.floor(Number(value('page')) || 1))) - 1) * 24)
  });
  const q = value('q').trim().slice(0, 100),
    categoryValue = category ?? value('category');
  if (q) query.set('q', q);
  if (categoryValue) query.set('category', categoryValue);
  const min = value('min'),
    max = value('max');
  let invalid = false;
  for (const [key, amount] of [
    ['minPrice', min],
    ['maxPrice', max]
  ])
    if (amount) {
      const number = Number(amount);
      if (!Number.isFinite(number) || number < 0 || number > 100000) invalid = true;
      else query.set(key!, String(Math.round(number * 1000)));
    }
  if (min && max && Number(min) > Number(max)) invalid = true;
  const sort = ['newest', 'price_asc', 'price_desc'].includes(value('sort'))
    ? value('sort')
    : 'newest';
  query.set('sort', sort);
  if (value('available') === '1') query.set('available', '1');
  if (promotions || value('promotion') === '1') query.set('promotion', '1');
  let unavailable = false;
  const [products, categories] = await Promise.all([
    invalid
      ? Promise.resolve([] as ApiProduct[])
      : apiRequest<ApiProduct[]>(`/products?${query}`).catch(() => {
          unavailable = true;
          return [];
        }),
    apiRequest<ApiCategory[]>('/categories').catch(() => [])
  ]);
  const action = promotions ? '/promotions' : category ? `/categories/${category}` : '/recherche';
  const page = Math.max(1, Math.min(10000, Math.floor(Number(value('page')) || 1)));
  function pageLink(next: number) {
    const parameters = new URLSearchParams();
    for (const [key, val] of Object.entries(params))
      if (typeof val === 'string' && key !== 'page') parameters.set(key, val);
    parameters.set('page', String(next));
    return `${action}?${parameters}`;
  }
  return (
    <PageShell>
      <section className={`page-heading ${promotions ? 'promotion-heading' : ''}`}>
        <p className="section-kicker">
          {promotions ? 'Les offres du moment' : 'Trouvez votre prochain appareil'}
        </p>
        <h1>
          {promotions
            ? 'Promotions'
            : category
              ? (categories.find((c) => c.slug === category)?.name ?? 'Catalogue')
              : 'Rechercher un produit'}
        </h1>
        <p>
          {promotions
            ? 'Des prix réduits, affichés en toute transparence.'
            : 'Affinez votre recherche et choisissez l’option qui vous convient.'}
        </p>
      </section>
      <form action={action} className="catalog-filters">
        <label className="filter-search">
          Recherche
          <input
            type="search"
            name="q"
            maxLength={100}
            defaultValue={q}
            placeholder="Smartphone, PC, TV…"
          />
        </label>
        {!category && (
          <label>
            Catégorie
            <select name="category" defaultValue={categoryValue}>
              <option value="">Toutes les catégories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Prix minimum (DT)
          <input
            name="min"
            type="number"
            min="0"
            max="100000"
            step="0.001"
            defaultValue={min}
            placeholder="0"
          />
        </label>
        <label>
          Prix maximum (DT)
          <input
            name="max"
            type="number"
            min="0"
            max="100000"
            step="0.001"
            defaultValue={max}
            placeholder="Sans limite"
          />
        </label>
        <label>
          Trier par
          <select name="sort" defaultValue={sort}>
            <option value="newest">Nouveautés</option>
            <option value="price_asc">Prix croissant</option>
            <option value="price_desc">Prix décroissant</option>
          </select>
        </label>
        <label className="filter-check">
          <input
            type="checkbox"
            name="available"
            value="1"
            defaultChecked={value('available') === '1'}
          />
          Disponibles uniquement
        </label>
        {!promotions && (
          <label className="filter-check">
            <input
              type="checkbox"
              name="promotion"
              value="1"
              defaultChecked={value('promotion') === '1'}
            />
            En promotion
          </label>
        )}
        <div className="filter-actions">
          <button className="primary-button" type="submit">
            Appliquer les filtres
          </button>
          <Link className="secondary-button" href={action}>
            Réinitialiser les filtres
          </Link>
        </div>
      </form>
      {invalid ? (
        <p className="notice" role="alert">
          Vérifiez la fourchette de prix : le minimum doit être inférieur ou égal au maximum.
        </p>
      ) : unavailable ? (
        <div className="empty-state">
          <h2>Catalogue temporairement indisponible</h2>
          <p>Veuillez réessayer dans quelques instants.</p>
          <a className="secondary-button" href={action}>
            Réessayer
          </a>
        </div>
      ) : products.length ? (
        <>
          <p className="result-count">
            {products.length} article(s) sur cette page · Page {page}
          </p>
          <div className="catalog-grid">
            {products.map((p) => (
              <CatalogCard key={p.id} product={fromApiProduct(p)} />
            ))}
          </div>
        </>
      ) : (
        <div className="empty-state">
          <h2>{promotions ? 'Aucune offre pour ces critères' : 'Aucun produit trouvé'}</h2>
          <p>Essayez une autre recherche ou retirez quelques filtres.</p>
          <Link className="secondary-button" href={action}>
            Réinitialiser les filtres
          </Link>
        </div>
      )}
      {!invalid && !unavailable && (
        <nav className="catalog-pagination" aria-label="Pagination">
          {page > 1 && (
            <Link className="secondary-button" href={pageLink(page - 1)}>
              ← Précédent
            </Link>
          )}
          {products.length === 24 && (
            <Link className="secondary-button" href={pageLink(page + 1)}>
              Suivant →
            </Link>
          )}
        </nav>
      )}
    </PageShell>
  );
}
