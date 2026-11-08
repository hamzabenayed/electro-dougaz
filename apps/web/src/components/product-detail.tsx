'use client';
import { useState } from 'react';
import type { CatalogProduct } from '../lib/catalog';
import { ProductGallery } from './product-gallery';
import { ProductPrice, ProductPromotion } from './product-promotion';
import { ProductAvailability } from './product-availability';
import { ProductPurchase } from './product-purchase';
import { RecentProducts } from './recent-products';
import { formatPrice } from '../lib/catalog';
export function ProductDetail({
  product,
  deliveryEstimate
}: {
  product: CatalogProduct;
  deliveryEstimate?: string;
}) {
  const [variantId, setVariantId] = useState(product.variantId);
  const variants = product.variants ?? [];
  const variant = variants.find((v) => v.id === variantId);
  const selected = variant
    ? {
        ...product,
        id: variant.id,
        variantId: variant.id,
        price: variant.priceMillimes / 1000,
        oldPrice: variant.compareAtPriceMillimes
          ? variant.compareAtPriceMillimes / 1000
          : undefined,
        stock: variant.stockQuantity,
        name: variants.length > 1 ? `${product.name} — ${variant.name}` : product.name
      }
    : product;
  return (
    <>
      <article className="product-detail">
        <div className="product-detail-visual">
          <ProductGallery slug={product.slug} name={product.name} images={product.images} />
          <ProductPromotion price={selected.price} oldPrice={selected.oldPrice} />
        </div>
        <div>
          <p className="product-category">{product.category}</p>
          <h1>{product.name}</h1>
          <p className="detail-summary">{product.summary}</p>
          {variants.length > 1 && (
            <fieldset className="variant-picker">
              <legend>Choisissez votre option</legend>
              {variants.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={option.id === variantId}
                  onClick={() => setVariantId(option.id)}
                >
                  <strong>{option.name}</strong>
                  <small>{option.stockQuantity > 0 ? 'Disponible' : 'Rupture de stock'}</small>
                </button>
              ))}
            </fieldset>
          )}
          <div aria-live="polite">
            <ProductPrice price={selected.price} oldPrice={selected.oldPrice} detail />
            <ProductAvailability available={selected.stock > 0} />
          </div>
          <div id="product-purchase">
            <ProductPurchase key={selected.id} product={selected} />
          </div>
          <div className="purchase-reassurance">
            <p>✓ Paiement en espèces à la livraison · Aucun compte nécessaire</p>
            {deliveryEstimate && <p>↗ Livraison estimée : {deliveryEstimate}</p>}
            <p>
              <a href="/livraison">Frais et conditions de livraison</a> ·{' '}
              <a href="/retours">Retours et garantie</a>
            </p>
          </div>
        </div>
      </article>
      <section className="product-information">
        <details open>
          <summary>Caractéristiques techniques</summary>
          <dl className="specification-list">
            {[
              { label: 'Référence', value: variant?.sku ?? product.specifications[0]?.value ?? '' },
              ...product.specifications.filter((s) => s.label !== 'Référence')
            ].map((item, index) => (
              <div key={index}>
                <dt>{item.label}</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
          </dl>
        </details>
        <details>
          <summary>Garantie et retours</summary>
          <p>
            {product.warranty ||
              'Contactez la boutique pour connaître la garantie applicable à ce produit.'}
          </p>
          <a href="/retours">Consulter les conditions de retour</a>
        </details>
      </section>
      <RecentProducts slug={product.slug} />
      <div className="mobile-buy-bar">
        <strong>{formatPrice(selected.price)} DT</strong>
        <a className="primary-button" href="#product-purchase">
          {selected.stock > 0 ? 'Choisir la quantité' : 'Voir la disponibilité'}
        </a>
      </div>
    </>
  );
}
