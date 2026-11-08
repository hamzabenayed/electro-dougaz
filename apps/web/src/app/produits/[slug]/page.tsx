import { notFound } from 'next/navigation';
import { PageShell } from '../../../components/page-shell';
import { ProductDetail } from '../../../components/product-detail';
import { CatalogCard } from '../../../components/catalog-card';
import { fromApiProduct } from '../../../lib/catalog';
import { apiRequest, ApiError, type ApiProduct } from '../../../lib/api';
export const dynamic = 'force-dynamic';
export default async function ProductPage({
  params,
  searchParams
}: Readonly<{ params: Promise<{ slug: string }>; searchParams?: Promise<{ option?: string }> }>) {
  const { slug } = await params;
  const [product, options] = await Promise.all([
    apiRequest<ApiProduct>(`/products/${encodeURIComponent(slug)}`)
      .then(fromApiProduct)
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 404) notFound();
        throw error;
      }),
    apiRequest<{ deliveryEstimate: string }>('/orders/options').catch(() => null)
  ]);
  const selected = (await searchParams)?.option;
  const accessories = await apiRequest<ApiProduct[]>(
    `/products/${encodeURIComponent(slug)}/accessories`
  ).catch(() => []);
  const related = await apiRequest<ApiProduct[]>(
    `/products?category=${encodeURIComponent(product.categorySlug)}&available=1&limit=5`
  ).catch(() => []);
  if (selected && product.variants?.some((v) => v.id === selected)) product.variantId = selected;
  return (
    <PageShell>
      <nav className="breadcrumbs" aria-label="Fil d’Ariane">
        <a href="/">Accueil</a>
        <span>/</span>
        <a href={`/categories/${product.categorySlug}`}>{product.category}</a>
      </nav>
      <ProductDetail product={product} deliveryEstimate={options?.deliveryEstimate} />
      {accessories.length > 0 && (
        <section className="recent-products">
          <h2>Accessoires compatibles sélectionnés par la boutique</h2>
          <div className="product-grid">
            {accessories.map((p) => (
              <CatalogCard key={p.id} product={fromApiProduct(p)} />
            ))}
          </div>
        </section>
      )}
      {related.some((p) => p.slug !== slug) && (
        <section className="recent-products">
          <h2>Dans la même catégorie</h2>
          <div className="product-grid">
            {related
              .filter((p) => p.slug !== slug)
              .slice(0, 4)
              .map((p) => (
                <CatalogCard key={p.id} product={fromApiProduct(p)} />
              ))}
          </div>
        </section>
      )}
    </PageShell>
  );
}
