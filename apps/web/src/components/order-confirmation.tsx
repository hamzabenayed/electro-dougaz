'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { formatMillimes } from '../lib/api';

export function OrderConfirmation({
  reference,
  totalMillimes
}: {
  reference: string;
  totalMillimes: number;
}) {
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    heading.current?.focus();
  }, []);
  useEffect(() => {
    if (saved) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [saved]);

  async function copy() {
    setBusy(true);
    setFailed(false);
    try {
      await navigator.clipboard.writeText(reference);
      setSaved(true);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page-main container">
      <section className="success-state order-confirmation" aria-labelledby="confirmation-title">
        <h1 id="confirmation-title" ref={heading} tabIndex={-1}>
          Demande de commande enregistrée
        </h1>
        <p>Votre commande a bien été enregistrée. Ne la passez pas une seconde fois.</p>
        <p>Total à régler à la livraison : {formatMillimes(totalMillimes)} DT</p>
        <div className="reference-reminder">
          <h2>Avant de partir, conservez votre référence</h2>
          <p>
            Elle est nécessaire, avec le téléphone utilisé lors de la commande, pour suivre votre
            livraison. Aucun email ni SMS ne vous sera envoyé.
          </p>
          <label htmlFor="order-reference">Votre référence de commande</label>
          <input
            id="order-reference"
            readOnly
            value={reference}
            onFocus={(event) => event.currentTarget.select()}
          />
          <p id="reference-instructions">
            Copiez la référence pour activer les boutons de navigation, puis conservez-la dans vos
            notes. Vous pouvez aussi faire une capture d’écran.
          </p>
          <button
            type="button"
            className="primary-button"
            disabled={busy}
            onClick={() => void copy()}
            aria-describedby="reference-instructions"
          >
            {busy ? 'Copie en cours…' : saved ? 'Copier à nouveau' : 'Copier la référence'}
          </button>
          {failed && (
            <div role="alert">
              <p>
                La copie automatique est indisponible. Sélectionnez la référence ci-dessus et
                copiez-la manuellement, ou faites une capture d’écran.
              </p>
              <button type="button" className="secondary-button" onClick={() => setSaved(true)}>
                J’ai conservé ma référence
              </button>
            </div>
          )}
          <p role="status">
            {saved
              ? 'Référence conservée. Vous pouvez maintenant continuer.'
              : 'Navigation disponible après avoir conservé votre référence.'}
          </p>
        </div>
        <div className="confirmation-actions">
          {saved ? (
            <>
              <Link className="primary-button" href="/suivi-commande">
                Suivre ma commande
              </Link>
              <Link className="secondary-button" href="/">
                Retour à l’accueil
              </Link>
            </>
          ) : (
            <>
              <button className="primary-button" disabled>
                Suivre ma commande
              </button>
              <button className="secondary-button" disabled>
                Retour à l’accueil
              </button>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
