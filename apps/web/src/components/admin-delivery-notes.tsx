'use client';
import { useRef, useState } from 'react';
import { adminRequest } from '../lib/admin-api';
import { AdminIcon } from './admin-icon';
import { OrderDocument, type DeliveryOrder } from './order-document';

export function AdminDeliveryNotes({
  selected,
  from,
  to,
  status,
  clearSelection
}: {
  selected: string[];
  from: string;
  to: string;
  status: string;
  clearSelection: () => void;
}) {
  const [documents, setDocuments] = useState<DeliveryOrder[]>([]);
  const [ready, setReady] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [prepared, setPrepared] = useState(false);
  const pending = useRef(false);
  async function prepare(mode: 'selection' | 'dates') {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    setDocuments([]);
    setReady([]);
    setPrepared(false);
    try {
      const data = await adminRequest<DeliveryOrder[]>('/admin/orders/delivery-notes', {
        method: 'POST',
        body: JSON.stringify(
          mode === 'selection'
            ? { mode, ids: selected }
            : { mode, from, to, ...(status ? { status } : {}) }
        )
      });
      setDocuments(data);
      setPrepared(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Préparation impossible');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <section
      className="admin-panel report-section delivery-batch"
      aria-label="Bons de livraison groupés"
    >
      <header>
        <div>
          <h2>
            <AdminIcon name="truck" /> Bons de livraison groupés
          </h2>
          <p>
            Sélectionnez des commandes ou utilisez les dates ci-dessus. Un bon par commande, 50
            commandes maximum par PDF.
          </p>
        </div>
      </header>
      <p>
        La période utilise la date de création, en heure de Tunis, et le statut choisi. La recherche
        par nom / référence ne s’applique pas à l’export par période.
      </p>
      <div className="operations-actions">
        <button
          className="admin-primary-button"
          disabled={busy || !selected.length}
          onClick={() => void prepare('selection')}
        >
          Préparer la sélection ({selected.length}/50)
        </button>
        <button
          className="admin-secondary-button"
          disabled={busy || !from || !to || from > to}
          onClick={() => void prepare('dates')}
        >
          Préparer la période
        </button>
        {!!selected.length && (
          <button className="admin-secondary-button" disabled={busy} onClick={clearSelection}>
            Effacer la sélection
          </button>
        )}
      </div>
      {busy && <p role="status">Préparation des documents…</p>}
      {error && <p role="alert">{error}</p>}
      {prepared && (
        <p role="status">
          {documents.length
            ? `${documents.length} bon(s) prêt(s). Vérifiez l’aperçu avant d’imprimer.`
            : 'Aucune commande pour cette période et ce statut.'}
        </p>
      )}
      {!!documents.length && (
        <div className="operations-actions">
          <button
            className="admin-primary-button"
            disabled={busy || ready.length !== documents.length}
            onClick={() => window.print()}
          >
            Imprimer / Enregistrer les bons en PDF
          </button>
          <p>
            Choisissez « Enregistrer au format PDF ». Chaque bon commence sur une nouvelle page.
          </p>
        </div>
      )}
      {documents.map((order) => (
        <OrderDocument
          key={order.id}
          order={order}
          collected={order.collectedMillimes}
          refunded={order.refundedMillimes}
          onLogoReady={() => setReady((ids) => (ids.includes(order.id) ? ids : [...ids, order.id]))}
        />
      ))}
    </section>
  );
}
