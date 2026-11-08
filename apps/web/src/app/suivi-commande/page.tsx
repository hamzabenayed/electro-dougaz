'use client';

import { useState, useRef, type FormEvent } from 'react';
import { PageShell } from '../../components/page-shell';

import { apiRequest } from '../../lib/api';
import { OrderTimeline, type TrackingResult } from '../../components/order-timeline';

export default function TrackingPage() {
  const [result, setResult] = useState<TrackingResult>();
  const pending = useRef(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function track(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    setResult(undefined);
    const data = new FormData(event.currentTarget);
    try {
      setResult(
        await apiRequest('/orders/track', {
          method: 'POST',
          body: JSON.stringify({ reference: data.get('reference'), phone: data.get('phone') })
        })
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Suivi indisponible');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <PageShell>
      <section className="page-heading">
        <p className="section-kicker">Sans compte</p>
        <h1>Suivre ma commande</h1>
        <p>Saisissez la référence reçue après validation et le téléphone associé.</p>
      </section>
      <form className="form-card narrow-form" onSubmit={(event) => void track(event)}>
        <label>
          Référence de commande
          <input
            name="reference"
            maxLength={40}
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="ED-2026-…"
            required
          />
        </label>
        <label>
          Numéro de téléphone
          <input
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            pattern="\+?[0-9 ]{8,16}"
            required
          />
        </label>
        <button className="primary-button" type="submit" disabled={busy}>
          {busy ? 'Recherche en cours…' : 'Afficher le suivi'}
        </button>
      </form>
      {error ? <p role="alert">{error}</p> : null}
      {result ? <OrderTimeline result={result} /> : null}
    </PageShell>
  );
}
