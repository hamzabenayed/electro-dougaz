'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { useCart } from './cart-context';
import { ProductImage } from './product-image';
import { formatPrice } from '../lib/catalog';

export function CartDrawer() {
  const { isOpen, closeCart, lines, count, total, update, remove, hydrated } = useCart();
  const dialog = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  useEffect(() => {
    closeCart();
  }, [pathname, closeCart]);
  useEffect(() => {
    const element = dialog.current;
    if (!isOpen || !element) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (!element.open) element.showModal();
    return () => {
      element.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);
  return (
    <dialog
      ref={dialog}
      id="cart-drawer"
      className="cart-drawer"
      aria-labelledby="cart-drawer-title"
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        const controls = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not(:disabled), a[href], select:not(:disabled)'
          )
        );
        const first = controls[0];
        const last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        closeCart();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        )
          closeCart();
      }}
    >
      <div className="cart-drawer-panel">
        <header className="cart-drawer-header">
          <div>
            <p>Votre sélection</p>
            <h2 id="cart-drawer-title">
              Mon panier <span>({count})</span>
            </h2>
          </div>
          <button
            type="button"
            className="cart-drawer-close"
            onClick={closeCart}
            aria-label="Fermer le panier"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="m6 6 12 12M6 18 18 6" />
            </svg>
          </button>
        </header>
        <div className="cart-drawer-body">
          {!hydrated ? (
            <p role="status">Chargement du panier…</p>
          ) : !lines.length ? (
            <div className="cart-drawer-empty">
              <svg
                width="56"
                height="56"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                aria-hidden="true"
              >
                <path d="M3 4h2l2 10h11l2-7H6M9 19h.01M17 19h.01" />
              </svg>
              <h3>Votre panier est vide</h3>
              <p>Ajoutez les produits qui vous plaisent, sans quitter votre visite.</p>
              <button type="button" className="primary-button" onClick={closeCart}>
                Continuer mes achats
              </button>
            </div>
          ) : (
            <ul className="cart-drawer-lines" aria-label="Articles du panier">
              {lines.map((line) => (
                <li key={line.id} className="cart-drawer-item">
                  <div className="cart-drawer-image">
                    <ProductImage slug={line.slug} name={line.name} imageId={line.imageId} />
                  </div>
                  <div className="cart-drawer-item-info">
                    <h3>
                      <Link href={`/produits/${line.slug}`} onClick={closeCart}>
                        {line.name}
                      </Link>
                    </h3>
                    <p>{formatPrice(line.price)} DT l’unité</p>
                    <div className="cart-drawer-item-actions">
                      <label>
                        Quantité <span className="sr-only">pour {line.name}</span>
                        <select
                          value={line.quantity}
                          onChange={(event) => update(line.id, Number(event.target.value))}
                        >
                          {Array.from(
                            { length: Math.max(1, Math.min(line.stock ?? 10, 10)) },
                            (_, index) => (
                              <option value={index + 1} key={index}>
                                {index + 1}
                              </option>
                            )
                          )}
                        </select>
                      </label>
                      <button
                        type="button"
                        onClick={() => remove(line.id)}
                        aria-label={`Supprimer ${line.name}`}
                      >
                        Supprimer
                      </button>
                    </div>
                    <strong>{formatPrice(line.price * line.quantity)} DT</strong>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        {hydrated && lines.length > 0 && (
          <footer className="cart-drawer-footer">
            <div className="cart-drawer-total" aria-live="polite">
              <span>Sous-total</span>
              <strong>{formatPrice(total)} DT</strong>
            </div>
            <p>
              Frais de livraison calculés à l’étape suivante. Prix et disponibilité vérifiés à la
              commande.
            </p>
            <Link className="primary-button" href="/commande" onClick={closeCart}>
              Passer la commande <span aria-hidden="true">→</span>
            </Link>
            <button type="button" className="secondary-button" onClick={closeCart}>
              Continuer mes achats
            </button>
          </footer>
        )}
      </div>
    </dialog>
  );
}
