'use client';

import { ProductImage } from '../../../../components/product-image';
import { AdminSavedImage } from '../../../../components/admin-saved-image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AdminIcon } from '../../../../components/admin-icon';
import { AdminPageHeader, StatusBadge } from '../../../../components/admin-ui';
import { apiRequest, formatMillimes, type ApiProduct } from '../../../../lib/api';
import { getAdminToken } from '../../../../lib/admin-session';

export default function ProductsPage() {
  const [query, setQuery] = useState('');
  const [stock, setStock] = useState('all');
  const [offset, setOffset] = useState(0);
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = getAdminToken();
    if (!token) {
      setError('Session expirée. Reconnectez-vous.');
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError('');
    const timer = setTimeout(() => {
      void apiRequest<ApiProduct[]>(
        `/admin/products?limit=30&offset=${offset}&q=${encodeURIComponent(query)}&stock=${stock}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
        .then((data) => {
          if (active) setProducts(data);
        })
        .catch((reason: unknown) => {
          if (active) setError(reason instanceof Error ? reason.message : 'Chargement impossible.');
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, offset, stock]);

  const visibleProducts = products;

  return (
    <>
      <AdminPageHeader
        eyebrow="Catalogue"
        title="Produits"
        description="Ajoutez vos articles et gardez les prix, photos et stocks à jour."
        action={{ href: '/admin/produits/nouveau', label: 'Ajouter un produit' }}
      />
      <section className="admin-toolbar">
        <label className="admin-filter-search">
          <AdminIcon name="search" />
          <span className="sr-only">Rechercher un produit</span>
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setOffset(0);
            }}
            type="search"
            placeholder="Nom ou catégorie"
          />
        </label>
        <label>
          Disponibilité du stock
          <select
            value={stock}
            onChange={(event) => {
              setStock(event.target.value);
              setOffset(0);
            }}
          >
            <option value="all">Tous les produits</option>
            <option value="available">Disponibles</option>
            <option value="out_of_stock">En rupture — aucune option disponible</option>
            <option value="low">À réapprovisionner — au moins une option</option>
          </select>
        </label>
      </section>
      {error ? (
        <div className="admin-image-error" role="alert">
          {error}
        </div>
      ) : null}
      <section className="admin-panel">
        {loading ? <p className="empty-state">Chargement des produits…</p> : null}
        {!loading && !error && visibleProducts.length === 0 ? (
          <div className="empty-state">
            <h2>Aucun produit</h2>
            <p>Ajoutez votre premier produit ou modifiez la recherche.</p>
          </div>
        ) : null}
        {!loading && visibleProducts.length > 0 ? (
          <div className="admin-table-wrap">
            <table className="admin-table products-table">
              <thead>
                <tr>
                  <th>Produit</th>
                  <th>Catégorie</th>
                  <th>Prix</th>
                  <th>Stock</th>
                  <th>Visibilité</th>
                  <th>
                    <span className="sr-only">Action</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleProducts.map((product) => {
                  const variants = product.variants?.length ? product.variants : [product.variant];
                  const stockTotal = variants.reduce(
                    (total, variant) => total + variant.stockQuantity,
                    0
                  );
                  const low = variants.some(
                    (variant) => variant.stockQuantity <= variant.lowStockThreshold
                  );
                  return (
                    <tr key={product.id}>
                      <td data-label="Produit">
                        <div className="admin-product-cell">
                          <span className="admin-product-thumb">
                            {product.images?.[0] ? (
                              <AdminSavedImage id={product.images[0].id} alt={product.name} />
                            ) : (
                              <ProductImage slug={product.slug} name={product.name} />
                            )}
                          </span>
                          <strong>{product.name}</strong>
                        </div>
                      </td>
                      <td data-label="Catégorie">{product.category.name}</td>
                      <td data-label="Prix">
                        <strong>{formatMillimes(product.variant.priceMillimes)} DT</strong>
                      </td>
                      <td data-label="Stock">
                        <StatusBadge
                          tone={stockTotal === 0 ? 'danger' : low ? 'warning' : 'success'}
                        >
                          {stockTotal === 0 ? 'En rupture' : `${stockTotal} unités`}
                        </StatusBadge>
                        {variants.length > 1 && (
                          <small>{variants.length} options · total disponible</small>
                        )}
                      </td>
                      <td data-label="Visibilité">
                        <StatusBadge tone={product.status === 'published' ? 'success' : 'neutral'}>
                          {product.status === 'published' ? 'Publié' : 'Brouillon'}
                        </StatusBadge>
                      </td>
                      <td>
                        <Link
                          className="row-action"
                          href={`/admin/produits/${product.id}`}
                          aria-label={`Modifier ${product.name}`}
                        >
                          <AdminIcon name="arrow" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
      <div className="admin-toolbar">
        <button
          disabled={offset === 0 || loading}
          onClick={() => setOffset(Math.max(0, offset - 30))}
        >
          Précédent
        </button>
        <button disabled={products.length < 30 || loading} onClick={() => setOffset(offset + 30)}>
          Suivant
        </button>
      </div>
    </>
  );
}
