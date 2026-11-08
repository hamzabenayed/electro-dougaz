'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { adminRequest } from '../lib/admin-api';
import { formText } from '../lib/form-text';
import { type ApiProduct } from '../lib/api';
import { ProductPrice, ProductPromotion } from './product-promotion';
import { AdminPageHeader, AdminLoading } from './admin-ui';
import { AdminIcon } from './admin-icon';
export function promotionState(product: ApiProduct, now = Date.now()) {
  if (
    !(product.variants ?? [product.variant]).some(
      (v) => (v.compareAtPriceMillimes ?? 0) > v.priceMillimes
    )
  )
    return 'Sans remise';
  if (product.promotionStartsAt && Date.parse(product.promotionStartsAt) > now) return 'Programmée';
  if (product.promotionEndsAt && Date.parse(product.promotionEndsAt) <= now) return 'Terminée';
  return 'Active';
}
function tunisInput(value?: string | null) {
  return value ? new Date(Date.parse(value) + 3600000).toISOString().slice(0, 16) : '';
}
function PromotionEditor({ product }: { product: ApiProduct }) {
  const [current, setCurrent] = useState(product),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  return (
    <article className="admin-panel report-section promotion-editor">
      <header>
        <div>
          <h2>
            <AdminIcon name="products" />
            {current.name}
          </h2>
          <p>
            {promotionState(current)} ·{' '}
            {current.status === 'published' ? 'Publié' : 'Brouillon — non visible'}
          </p>
        </div>
        <Link href={`/admin/produits/${current.id}`}>Modifier les prix et les options →</Link>
      </header>
      <div className="promotion-preview">
        <ProductPromotion
          price={current.variant.priceMillimes / 1000}
          oldPrice={(current.variant.compareAtPriceMillimes ?? 0) / 1000}
        />
        <ProductPrice
          price={current.variant.priceMillimes / 1000}
          oldPrice={(current.variant.compareAtPriceMillimes ?? 0) / 1000}
        />
      </div>
      <p className="promotion-help">
        Aperçu du tarif promotionnel de l’option principale, appliqué uniquement pendant la période
        active.
      </p>
      <form
        className="report-filters"
        onSubmit={(e) => {
          e.preventDefault();
          if (busy) return;
          const data = new FormData(e.currentTarget);
          const starts = formText(data.get('starts')),
            ends = formText(data.get('ends'));
          void (async () => {
            setBusy(true);
            setMessage('');
            try {
              const body = {
                startsAt: starts ? new Date(`${starts}:00+01:00`).toISOString() : null,
                endsAt: ends ? new Date(`${ends}:00+01:00`).toISOString() : null
              };
              await adminRequest(`/admin/products/${current.id}/promotion-schedule`, {
                method: 'PUT',
                body: JSON.stringify(body)
              });
              setCurrent({
                ...current,
                promotionStartsAt: body.startsAt,
                promotionEndsAt: body.endsAt
              });
              setMessage('Période enregistrée.');
            } catch (err) {
              setMessage(err instanceof Error ? err.message : 'Enregistrement impossible');
            } finally {
              setBusy(false);
            }
          })();
        }}
      >
        <label>
          Début (heure de Tunis)
          <input
            type="datetime-local"
            name="starts"
            defaultValue={tunisInput(current.promotionStartsAt)}
          />
        </label>
        <label>
          Fin exclusive (heure de Tunis)
          <input
            type="datetime-local"
            name="ends"
            defaultValue={tunisInput(current.promotionEndsAt)}
          />
        </label>
        <div className="admin-form-actions">
          <button className="admin-primary-button" disabled={busy}>
            {busy ? 'Enregistrement…' : 'Enregistrer la période'}
          </button>
        </div>
      </form>
      <p>
        Dates vides : remise sans limite de temps. Hors période, le prix avant remise s’applique. La
        période concerne toutes les options remisées de ce produit.
      </p>
      <p role="status">{message}</p>
    </article>
  );
}
export function AdminPromotions() {
  const [q, setQ] = useState(''),
    [offset, setOffset] = useState(0),
    [products, setProducts] = useState<ApiProduct[]>([]),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    adminRequest<ApiProduct[]>(
      `/admin/products?limit=20&offset=${offset}&q=${encodeURIComponent(q)}`
    )
      .then((p) => {
        if (active) setProducts(p);
      })
      .catch((e: unknown) => {
        if (active) setError(e instanceof Error ? e.message : 'Chargement impossible');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [q, offset]);
  return (
    <>
      <AdminPageHeader
        eyebrow="Catalogue"
        title="Promotions"
        description="Préparez vos offres, vérifiez les économies et programmez leur disponibilité."
      />
      <form
        className="admin-toolbar"
        onSubmit={(e) => {
          e.preventDefault();
          setQ(formText(new FormData(e.currentTarget).get('q')));
          setOffset(0);
        }}
      >
        <label>
          Produit ou référence
          <input name="q" type="search" maxLength={100} />
        </label>
        <button className="admin-primary-button">Rechercher</button>
      </form>
      {error && <p role="alert">{error}</p>}
      {loading ? (
        <AdminLoading label="Chargement des promotions…" />
      ) : (
        <>
          {products.map((p) => (
            <PromotionEditor
              key={`${p.id}-${p.promotionStartsAt}-${p.promotionEndsAt}`}
              product={p}
            />
          ))}
          {!products.length && <p>Aucun produit trouvé.</p>}
          <div className="admin-toolbar">
            <button disabled={!offset} onClick={() => setOffset((v) => v - 20)}>
              Précédent
            </button>
            <button disabled={products.length < 20} onClick={() => setOffset((v) => v + 20)}>
              Suivant
            </button>
          </div>
        </>
      )}
    </>
  );
}
