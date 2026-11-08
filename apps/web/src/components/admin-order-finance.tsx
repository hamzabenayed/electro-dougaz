'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { adminRequest } from '../lib/admin-api';
import { formText } from '../lib/form-text';
import { formatMillimes } from '../lib/api';
import { orderLabels, type ApiOrder } from '../lib/orders';
type Entry = {
  id: string;
  kind: string;
  amountMillimes: number;
  note: string;
  actor: string;
  createdAt: string;
};
const kinds: Record<string, string> = {
  collected: 'Collecte par le livreur',
  received: 'Réception par la boutique',
  refunded: 'Remboursement au client'
};
export function AdminOrderFinance({ order }: { order: ApiOrder }) {
  const [entries, setEntries] = useState<Entry[]>([]),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(false),
    [revision, setRevision] = useState(0);
  const attempt = useRef<{ fingerprint: string; key: string } | undefined>(undefined);
  const pending = useRef(false);
  const [document, setDocument] = useState('summary');
  useEffect(() => {
    let active = true;
    setLoaded(false);
    adminRequest<Entry[]>(`/admin/orders/${order.id}/payments`)
      .then((e) => {
        if (active) {
          setEntries(e);
          setLoaded(true);
        }
      })
      .catch((e: unknown) => {
        if (active) setError(e instanceof Error ? e.message : 'Paiements indisponibles');
      });
    return () => {
      active = false;
    };
  }, [order.id, revision]);
  async function record(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending.current) return;
    const form = e.currentTarget,
      data = new FormData(form);
    const amount = formText(data.get('amount')).replace(',', '.');
    if (!/^\d+(\.\d{1,3})?$/.test(amount)) {
      setError('Montant en DT, avec trois décimales maximum.');
      return;
    }
    const body = {
      kind: formText(data.get('kind')),
      amountMillimes: Math.round(Number(amount) * 1000),
      note: formText(data.get('note')).trim()
    };
    const fingerprint = JSON.stringify(body);
    if (attempt.current?.fingerprint !== fingerprint)
      attempt.current = { fingerprint, key: crypto.randomUUID() };
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      await adminRequest(`/admin/orders/${order.id}/payments`, {
        method: 'POST',
        body: JSON.stringify({ ...body, requestKey: attempt.current.key })
      });
      attempt.current = undefined;
      form.reset();
      setRevision((v) => v + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Enregistrement impossible');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  const sum = (kind: string) =>
    entries.filter((e) => e.kind === kind).reduce((n, e) => n + e.amountMillimes, 0);
  return (
    <>
      <section className="admin-panel report-section">
        <h2>Paiements et reversements</h2>
        <p>
          Enregistrez uniquement des mouvements réellement vérifiés. Un paiement collecté par le
          livreur n’est pas encore reçu par la boutique.
        </p>
        {error && <p role="alert">{error}</p>}
        <div className="report-metrics">
          {Object.entries(kinds).map(([key, label]) => (
            <p key={key}>
              {label}
              <br />
              <strong>{formatMillimes(sum(key))} DT</strong>
            </p>
          ))}
        </div>
        {['delivered', 'returned'].includes(order.status) ? (
          <form className="report-filters" onSubmit={(e) => void record(e)}>
            <label>
              Mouvement
              <select name="kind">
                {Object.entries(kinds).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Montant (DT)
              <input name="amount" inputMode="decimal" required placeholder="Ex. 150,000" />
            </label>
            <label>
              Référence / motif
              <input
                name="note"
                required
                minLength={3}
                maxLength={300}
                placeholder="Bordereau livreur ou motif du remboursement"
              />
            </label>
            <button className="admin-primary-button" disabled={busy || !loaded}>
              {busy ? 'Enregistrement…' : 'Enregistrer le mouvement'}
            </button>
          </form>
        ) : (
          <p>
            Les mouvements sont disponibles après livraison. Les droits de gestion sont nécessaires.
          </p>
        )}
        <ol className="activity-list">
          {entries.map((e) => (
            <li key={e.id}>
              <strong>
                {kinds[e.kind]} · {formatMillimes(e.amountMillimes)} DT
              </strong>
              <p>{e.note}</p>
              <small>
                {new Date(e.createdAt).toLocaleString('fr-TN', { timeZone: 'Africa/Tunis' })} ·{' '}
                {e.actor}
              </small>
            </li>
          ))}
        </ol>
        {loaded && !entries.length && <p>Aucun mouvement enregistré.</p>}
      </section>
      <section className="admin-panel report-section">
        <h2>Historique réel de la commande</h2>
        <ol className="activity-list">
          {order.history?.map((e, i) => (
            <li key={i}>
              {orderLabels[e.status] ?? e.status} ·{' '}
              {new Date(e.at).toLocaleString('fr-TN', { timeZone: 'Africa/Tunis' })}
            </li>
          ))}
        </ol>
      </section>
      <section className="admin-panel report-section">
        <h2>Documents</h2>
        <div className="admin-toolbar">
          <label>
            Document
            <select value={document} onChange={(e) => setDocument(e.target.value)}>
              <option value="summary">Récapitulatif de commande</option>
              <option value="delivery">Bon de livraison</option>
            </select>
          </label>
          <button className="admin-primary-button" onClick={() => window.print()}>
            Imprimer / Enregistrer en PDF
          </button>
        </div>
        <p>
          Choisissez « Enregistrer au format PDF » dans la fenêtre d’impression. Ce document n’est
          pas une facture fiscale.
        </p>
        <article className="print-document">
          <h2>
            Electro Dougaz —{' '}
            {document === 'delivery' ? 'Bon de livraison' : 'Récapitulatif de commande'}
          </h2>
          <p>
            {order.reference} ·{' '}
            {new Date(order.createdAt).toLocaleDateString('fr-TN', { timeZone: 'Africa/Tunis' })}
          </p>
          <p>
            {order.customer.firstName} {order.customer.lastName}
            <br />
            {order.customer.phone}
            <br />
            {order.customer.address}, {order.customer.governorate}
          </p>
          <table>
            <thead>
              <tr>
                <th>Article</th>
                <th>Quantité</th>
                {document === 'summary' && <th>Total</th>}
              </tr>
            </thead>
            <tbody>
              {order.items?.map((i) => (
                <tr key={i.id}>
                  <td>{i.productName}</td>
                  <td>{i.quantity}</td>
                  {document === 'summary' && <td>{formatMillimes(i.lineTotalMillimes)} DT</td>}
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            Livraison : {formatMillimes(order.deliveryMillimes)} DT · Total de la commande :{' '}
            {formatMillimes(order.totalMillimes)} DT
          </p>
          <p>
            Déjà collecté : {formatMillimes(sum('collected'))} DT · Reste à collecter :{' '}
            {formatMillimes(Math.max(0, order.totalMillimes - sum('collected')))} DT
          </p>
          {document === 'delivery' && (
            <p>Réceptionné le : __________________ Signature : __________________</p>
          )}
          <small>
            Document de suivi — ne constitue pas une facture fiscale ni une preuve de paiement.
          </small>
        </article>
      </section>
    </>
  );
}
