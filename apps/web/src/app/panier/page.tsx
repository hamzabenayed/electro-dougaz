'use client';

import { ProductImage } from '../../components/product-image';
import Link from 'next/link';
import { PageShell } from '../../components/page-shell';
import { useCart } from '../../components/cart-context';

export default function CartPage() {
  const { lines, total, update, remove } = useCart();
  return (
    <PageShell>
      <section className="page-heading">
        <p className="section-kicker">Votre sélection</p>
        <h1>Panier</h1>
      </section>
      {lines.length === 0 ? (
        <div className="empty-state">
          <h2>Votre panier est vide</h2>
          <p>Découvrez nos produits et ajoutez ceux qui vous plaisent.</p>
          <Link className="primary-button" href="/recherche">
            Découvrir les produits
          </Link>
        </div>
      ) : (
        <div className="cart-layout">
          <section className="cart-lines" aria-label="Articles du panier">
            {lines.map((line) => (
              <article className="cart-line" key={line.id}>
                <div className="cart-thumb" aria-hidden="true">
                  <ProductImage slug={line.slug} name={line.name} imageId={line.imageId} />
                </div>
                <div>
                  <h2>
                    <Link href={`/produits/${line.slug}`}>{line.name}</Link>
                  </h2>
                  <p>{line.price.toFixed(3).replace('.', ',')} DT l’unité</p>
                  <button className="text-button" type="button" onClick={() => remove(line.id)}>
                    Supprimer
                  </button>
                </div>
                <label>
                  Quantité
                  <select
                    value={line.quantity}
                    onChange={(event) => update(line.id, Number(event.target.value))}
                  >
                    {Array.from(
                      { length: Math.min(line.stock ?? 10, 10) },
                      (_, index) => index + 1
                    ).map((quantity) => (
                      <option value={quantity} key={quantity}>
                        {quantity}
                      </option>
                    ))}
                  </select>
                </label>
                <strong>{(line.price * line.quantity).toFixed(3).replace('.', ',')} DT</strong>
              </article>
            ))}
          </section>
          <aside className="order-summary">
            <h2>Résumé</h2>
            <div>
              <span>Sous-total</span>
              <strong>{total.toFixed(3).replace('.', ',')} DT</strong>
            </div>
            <div>
              <span>Livraison</span>
              <span>Calculée à l’étape suivante</span>
            </div>
            <p>Le montant final sera confirmé avant le paiement.</p>
            <Link className="primary-button" href="/commande">
              Passer la commande
            </Link>
            <Link className="secondary-button" href="/recherche">
              Continuer mes achats
            </Link>
          </aside>
        </div>
      )}
    </PageShell>
  );
}
