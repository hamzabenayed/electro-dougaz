import { ProductImage } from './product-image';
import Link from 'next/link';
import type { CatalogProduct } from '../lib/catalog';
import { AddToCartButton } from './cart-controls';
import { ProductAvailability } from './product-availability';
import { ProductPrice, ProductPromotion } from './product-promotion';

export function CatalogCard({ product }: Readonly<{ product: CatalogProduct }>) {
  const href = `/produits/${product.slug}${(product.variants?.length ?? 0) > 1 ? `?option=${encodeURIComponent(product.variantId ?? '')}` : ''}`;
  return (
    <article className="catalog-card">
      <Link
        className="catalog-card-visual"
        href={href}
        aria-label={`Voir ${product.name} — ${product.stock > 0 ? 'Disponible' : 'Rupture de stock'}`}
      >
        <ProductImage slug={product.slug} name={product.name} imageId={product.images?.[0]?.id} />
        <ProductPromotion price={product.price} oldPrice={product.oldPrice} />
        <ProductAvailability available={product.stock > 0} />
      </Link>
      <div>
        <p className="product-category">{product.category}</p>
        <h2>
          <Link href={href}>{product.name}</Link>
        </h2>
        <div className="product-footer">
          <ProductPrice price={product.price} oldPrice={product.oldPrice} />
          {(product.variants?.length ?? 0) > 1 ? (
            <Link className="primary-button" href={href}>
              Choisir
            </Link>
          ) : (
            <AddToCartButton compact product={product} />
          )}
        </div>
      </div>
    </article>
  );
}
