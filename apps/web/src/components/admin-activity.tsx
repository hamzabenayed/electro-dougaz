'use client';
import { useEffect, useState } from 'react';
import { adminRequest } from '../lib/admin-api';
import { AdminPageHeader, AdminLoading } from './admin-ui';
type Event = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: unknown;
  actor: string;
  createdAt: string;
};
export function AdminActivity() {
  const [query, setQuery] = useState(''),
    [offset, setOffset] = useState(0),
    [rows, setRows] = useState<Event[]>([]),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    adminRequest<Event[]>(`/admin/activity?${query}&offset=${offset}`)
      .then((v) => {
        if (active) setRows(v);
      })
      .catch((e: unknown) => {
        if (active) setError(e instanceof Error ? e.message : 'Historique indisponible');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [query, offset]);
  return (
    <>
      <AdminPageHeader
        eyebrow="Traçabilité"
        title="Historique des actions"
        description="Qui a modifié quoi et quand — heure de Tunis."
      />
      <form
        className="admin-panel report-filters"
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          const p = new URLSearchParams();
          for (const [k, v] of data) if (typeof v === 'string' && v) p.set(k, v);
          setQuery(p.toString());
          setOffset(0);
        }}
      >
        <label>
          Du
          <input type="date" name="from" />
        </label>
        <label>
          Au
          <input type="date" name="to" />
        </label>
        <label>
          Action
          <input name="q" placeholder="Ex. product, payment, stock" maxLength={100} />
        </label>
        <button className="admin-primary-button">Filtrer</button>
      </form>
      {error && <p role="alert">{error}</p>}
      {loading ? (
        <AdminLoading label="Chargement de l’historique…" />
      ) : (
        <section className="admin-panel report-section">
          <ol className="activity-list">
            {rows.map((e) => (
              <li key={e.id}>
                <strong>{e.action}</strong>
                <p>
                  {new Date(e.createdAt).toLocaleString('fr-TN', { timeZone: 'Africa/Tunis' })} ·{' '}
                  {e.actor ?? 'Système'}
                </p>
                <small>
                  {e.entityType} · {e.entityId}
                </small>
                <details>
                  <summary>Détails de la modification</summary>
                  <pre>{JSON.stringify(e.metadata, null, 2)}</pre>
                </details>
              </li>
            ))}
          </ol>
          {!rows.length && <p>Aucune action trouvée.</p>}
          <div className="admin-toolbar">
            <button disabled={!offset} onClick={() => setOffset((v) => v - 50)}>
              Précédent
            </button>
            <button disabled={rows.length < 50} onClick={() => setOffset((v) => v + 50)}>
              Suivant
            </button>
          </div>
        </section>
      )}
    </>
  );
}
