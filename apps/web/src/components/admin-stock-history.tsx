'use client';
import { useEffect, useState } from 'react';
import { adminRequest } from '../lib/admin-api';
import { AdminIcon } from './admin-icon';
import { StatusBadge } from './admin-ui';

export interface StockMovement {
  id: string;
  createdAt: string;
  productName: string;
  variantName: string;
  sku: string;
  quantityDelta: number;
  stockBefore: number | null;
  stockAfter: number | null;
  reason: string;
  note: string | null;
  actor: string | null;
  orderReference: string | null;
}
const reasons: Record<string, string> = {
  manual_adjustment: 'Ajustement manuel',
  initial_stock: 'Stock initial',
  product_edit: 'Fiche produit',
  order_reserved: 'Réservation de commande',
  order_cancelled: 'Commande annulée',
  restock: 'Réapprovisionnement',
  return: 'Retour'
};
export function AdminStockHistory({ revision }: { revision: number }) {
  const [rows, setRows] = useState<StockMovement[]>([]);
  const [filters, setFilters] = useState('');
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    adminRequest<StockMovement[]>(`/admin/inventory/history?offset=${offset}&${filters}`)
      .then((data) => {
        if (active) setRows(data);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Historique indisponible');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [filters, offset, revision]);
  return (
    <section className="admin-panel report-section stock-history" aria-label="Historique du stock">
      <header>
        <div>
          <h2>
            <AdminIcon name="clock" /> Historique du stock
          </h2>
          <p>Chaque entrée et sortie, sa raison et son auteur. Dates en heure de Tunis.</p>
        </div>
      </header>
      <form
        className="operations-filters"
        onSubmit={(event) => {
          event.preventDefault();
          const values = new FormData(event.currentTarget);
          const params = new URLSearchParams();
          for (const [key, value] of values)
            if (typeof value === 'string' && value.trim()) params.set(key, value.trim());
          setOffset(0);
          setFilters(params.toString());
        }}
      >
        <label>
          Produit / référence
          <input name="q" type="search" maxLength={100} placeholder="Nom ou référence" />
        </label>
        <label>
          Mouvements
          <select name="direction">
            <option value="all">Tous les mouvements</option>
            <option value="add">Entrées (+)</option>
            <option value="remove">Sorties (−)</option>
          </select>
        </label>
        <label>
          Du
          <input type="date" name="from" />
        </label>
        <label>
          Au (inclus)
          <input type="date" name="to" />
        </label>
        <button className="admin-primary-button" disabled={loading}>
          <AdminIcon name="search" /> Filtrer l’historique
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
      {loading ? (
        <p role="status">Chargement de l’historique…</p>
      ) : (
        !error && (
          <>
            {!rows.length ? (
              <p className="empty-state">Aucun mouvement pour ces critères.</p>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table movement-table">
                  <thead>
                    <tr>
                      <th>Date / auteur</th>
                      <th>Produit</th>
                      <th>Changement</th>
                      <th>Avant → après</th>
                      <th>Explication</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id}>
                        <td data-label="Date / auteur">
                          {new Date(row.createdAt).toLocaleString('fr-TN', {
                            timeZone: 'Africa/Tunis'
                          })}
                          <small>
                            {row.actor ||
                              (row.reason === 'order_reserved'
                                ? 'Automatique'
                                : 'Auteur non renseigné')}
                          </small>
                        </td>
                        <td data-label="Produit">
                          <strong>{row.productName}</strong>
                          <small>
                            {row.sku} · {row.variantName}
                          </small>
                        </td>
                        <td data-label="Changement">
                          <StatusBadge tone={row.quantityDelta > 0 ? 'success' : 'warning'}>
                            {row.quantityDelta > 0 ? '+' : '−'}
                            {Math.abs(row.quantityDelta)} unités
                          </StatusBadge>
                        </td>
                        <td data-label="Avant → après">
                          {row.stockBefore == null || row.stockAfter == null
                            ? 'Ancien mouvement — non enregistré'
                            : `${row.stockBefore} → ${row.stockAfter}`}
                        </td>
                        <td data-label="Explication">
                          <strong>{reasons[row.reason] ?? row.reason}</strong>
                          {row.note && <small>{row.note}</small>}
                          {row.orderReference && <small>Commande {row.orderReference}</small>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )
      )}
      <div className="operations-actions">
        <button
          className="admin-secondary-button"
          disabled={loading || offset === 0}
          onClick={() => setOffset(Math.max(0, offset - 50))}
        >
          Mouvements précédents
        </button>
        <button
          className="admin-secondary-button"
          disabled={loading || !!error || rows.length < 50}
          onClick={() => setOffset(offset + 50)}
        >
          Mouvements suivants
        </button>
      </div>
      <small>
        Les anciens mouvements restent consultables ; leurs quantités avant / après ne sont pas
        reconstituées.
      </small>
    </section>
  );
}
