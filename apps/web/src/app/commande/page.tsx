'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { PageShell } from '../../components/page-shell';
import { OrderConfirmation } from '../../components/order-confirmation';
import { useCart } from '../../components/cart-context';

import { apiRequest, ApiError, formatMillimes } from '../../lib/api';
import type { ApiOrder } from '../../lib/orders';
import { governorates, validateCheckout } from '../../lib/checkout-validation';

export default function CheckoutPage() {
  const { lines, total, clear, hydrated } = useCart();
  const [fields, setFields] = useState<Record<string, string>>({});
  const [quote, setQuote] = useState<{
    items: Array<{ variantId: string; name: string; quantity: number; unitPriceMillimes: number }>;
    subtotalMillimes: number;
    deliveryMillimes: number;
    totalMillimes: number;
  }>();
  const [revision, setRevision] = useState(0);
  const cartItems = JSON.stringify(
    lines.map((line) => ({ variantId: line.variantId, quantity: line.quantity }))
  );
  const [submitted, setSubmitted] = useState<ApiOrder>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [delivery, setDelivery] = useState<number>();
  const attempt = useRef<{ fingerprint: string; key: string } | null>(null);
  const pending = useRef(false);
  useEffect(() => {
    apiRequest<{ deliveryMillimes: number }>('/orders/options')
      .then((data) => setDelivery(data.deliveryMillimes))
      .catch(() => setError('Impossible de charger les frais de livraison. Rechargez la page.'));
  }, []);
  useEffect(() => {
    if (!hydrated || cartItems === '[]') return;
    let active = true;
    setQuote(undefined);
    apiRequest<NonNullable<typeof quote>>('/orders/quote', {
      method: 'POST',
      body: `{"items":${cartItems}}`
    })
      .then((value) => {
        if (active) {
          setQuote(value);
          setDelivery(value.deliveryMillimes);
          setError('');
        }
      })
      .catch((reason: unknown) => {
        if (active)
          setError(reason instanceof Error ? reason.message : 'Récapitulatif indisponible');
      });
    return () => {
      active = false;
    };
  }, [cartItems, hydrated, revision]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    if (lines.some((line) => !line.variantId))
      return setError(
        'Votre panier contient un ancien article. Videz-le et ajoutez les produits à nouveau.'
      );
    const data = new FormData(event.currentTarget);
    const validation = validateCheckout(data);
    setFields(validation);
    if (Object.keys(validation).length) {
      (event.currentTarget.elements.namedItem(Object.keys(validation)[0]!) as HTMLElement)?.focus();
      return;
    }
    if (!quote) return setError('Actualisez le récapitulatif avant de confirmer.');
    const payload = {
      firstName: data.get('firstName'),
      lastName: data.get('lastName'),
      phone: data.get('phone'),
      governorate: data.get('governorate'),
      address: data.get('address'),
      paymentMethod: 'cash_on_delivery',
      expectedTotalMillimes: quote.totalMillimes,
      items: lines.map((line) => ({ variantId: line.variantId, quantity: line.quantity }))
    };
    const fingerprint = JSON.stringify(payload);
    if (attempt.current?.fingerprint !== fingerprint)
      attempt.current = { fingerprint, key: crypto.randomUUID() };
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      const order = await apiRequest<ApiOrder>('/orders', {
        method: 'POST',
        headers: { 'Idempotency-Key': attempt.current.key },
        body: fingerprint
      });
      setSubmitted(order);
      clear();
    } catch (reason) {
      if (reason instanceof ApiError && reason.status < 500) attempt.current = null;
      setError(reason instanceof Error ? reason.message : 'Commande non confirmée. Réessayez.');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  if (submitted)
    return (
      <OrderConfirmation reference={submitted.reference} totalMillimes={submitted.totalMillimes} />
    );
  return (
    <PageShell>
      <section className="page-heading">
        <p className="section-kicker">Commande invité</p>
        <h1>Livraison et paiement</h1>
        <p>Aucun compte n’est nécessaire.</p>
      </section>
      {lines.length === 0 ? (
        <div className="empty-state">
          <h2>Aucun article à commander</h2>
          <p>Ajoutez d’abord un produit à votre panier.</p>
          <Link className="primary-button" href="/recherche">
            Voir le catalogue
          </Link>
        </div>
      ) : (
        <form
          className="checkout-layout"
          noValidate
          onChange={(event) => {
            const target = event.target;
            if (
              target instanceof HTMLInputElement ||
              target instanceof HTMLSelectElement ||
              target instanceof HTMLTextAreaElement
            ) {
              const name = target.name;
              if (fields[name])
                setFields((current) => {
                  const next = { ...current };
                  delete next[name];
                  return next;
                });
            }
          }}
          onSubmit={(event) => void submit(event)}
        >
          <section className="form-card">
            <h2>Coordonnées de livraison</h2>
            <div className="form-grid">
              <label>
                Prénom
                <input
                  name="firstName"
                  aria-label="Prénom"
                  autoComplete="given-name"
                  maxLength={80}
                  required
                  aria-invalid={!!fields.firstName}
                  aria-describedby="firstName-error"
                />
                <small id="firstName-error" className="field-error">
                  {fields.firstName}
                </small>
              </label>
              <label>
                Nom
                <input
                  name="lastName"
                  aria-label="Nom"
                  autoComplete="family-name"
                  maxLength={80}
                  required
                  aria-invalid={!!fields.lastName}
                  aria-describedby="lastName-error"
                />
                <small id="lastName-error" className="field-error">
                  {fields.lastName}
                </small>
              </label>
              <label>
                Téléphone
                <input
                  name="phone"
                  aria-label="Téléphone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  pattern="[0-9 +]{8,16}"
                  required
                  maxLength={17}
                  aria-invalid={!!fields.phone}
                  aria-describedby="phone-error"
                />
                <small id="phone-error" className="field-error">
                  {fields.phone}
                </small>
              </label>
              <label>
                Gouvernorat
                <select
                  name="governorate"
                  aria-label="Gouvernorat"
                  required
                  defaultValue=""
                  aria-invalid={!!fields.governorate}
                  aria-describedby="governorate-error"
                >
                  <option value="" disabled>
                    Choisir
                  </option>
                  {governorates.map((name) => (
                    <option key={name}>{name}</option>
                  ))}
                </select>
                <small id="governorate-error" className="field-error">
                  {fields.governorate}
                </small>
              </label>
              <label className="full-field">
                Adresse
                <textarea
                  name="address"
                  aria-label="Adresse"
                  autoComplete="street-address"
                  rows={3}
                  maxLength={500}
                  required
                  aria-invalid={!!fields.address}
                  aria-describedby="address-error"
                />
                <small id="address-error" className="field-error">
                  {fields.address}
                </small>
              </label>
            </div>
            <fieldset>
              <legend>Mode de paiement</legend>
              <label className="radio-card">
                <input type="radio" name="payment" value="cod" defaultChecked />
                <span>
                  <strong>Paiement à la livraison</strong>
                  <small>Réglez en espèces à la réception.</small>
                </span>
              </label>
              <label className="radio-card">
                <input type="radio" name="payment" value="card" disabled />
                <span>
                  <strong>Carte bancaire — ClicToPay</strong>
                  <small>Redirection sécurisée disponible après l’intégration bancaire.</small>
                </span>
              </label>
            </fieldset>
          </section>
          <aside className="order-summary">
            <h2>Votre commande</h2>
            {error ? <p role="alert">{error}</p> : null}
            <div>
              <span>{lines.reduce((sum, line) => sum + line.quantity, 0)} article(s)</span>
              <strong>
                {formatMillimes(quote?.subtotalMillimes ?? Math.round(total * 1000))} DT
              </strong>
            </div>
            {quote?.items.map((item) => (
              <p key={item.variantId}>
                {item.quantity} × {item.name}
                <br />
                <strong>{formatMillimes(item.unitPriceMillimes * item.quantity)} DT</strong>
              </p>
            ))}
            {quote && quote.subtotalMillimes !== Math.round(total * 1000) && (
              <p role="status">Les prix ont été actualisés. Vérifiez le total ci-dessous.</p>
            )}
            <p>
              Livraison :{' '}
              {delivery === undefined ? 'Chargement…' : `${formatMillimes(delivery)} DT`}
            </p>
            <p>
              Total :{' '}
              {quote ? `${formatMillimes(quote.totalMillimes)} DT` : 'Vérification des prix…'}
            </p>
            <p>Vos données serviront uniquement au traitement de la commande.</p>
            <button className="primary-button" type="submit" disabled={busy || !quote}>
              {busy ? 'Enregistrement…' : 'Confirmer la commande'}
            </button>
            <button
              type="button"
              className="secondary-button"
              disabled={busy}
              onClick={() => {
                setQuote(undefined);
                setRevision((value) => value + 1);
              }}
            >
              Actualiser le récapitulatif
            </button>
            <Link className="secondary-button" href="/panier">
              Modifier le panier
            </Link>
          </aside>
        </form>
      )}
    </PageShell>
  );
}
