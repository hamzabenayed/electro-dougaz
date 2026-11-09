'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { adminRequest } from '../lib/admin-api';
import type { InventoryRow } from './admin-overview';
import { AdminIcon } from './admin-icon';
import { AdminStockHistory } from './admin-stock-history';
import { AdminLoading, AdminPageHeader, StatusBadge } from './admin-ui';

const reasons = {
  add: [
    'Livraison fournisseur reçue',
    'Retour client vérifié',
    'Correction après comptage',
    'Autre raison'
  ],
  remove: [
    'Article abîmé ou défectueux',
    'Perte constatée',
    'Correction après comptage',
    'Autre raison'
  ]
};

export function AdminInventory() {
  const [items, setItems] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [variantId, setVariantId] = useState('');
  const [direction, setDirection] = useState<'add' | 'remove'>('add');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [reload, setReload] = useState(0);
  const productSelect = useRef<HTMLSelectElement>(null);
  const submitting = useRef(false);
  const attempt = useRef<{ fingerprint: string; key: string } | undefined>(undefined);
  const [historyRevision, setHistoryRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    adminRequest<InventoryRow[]>('/admin/inventory')
      .then((value) => {
        if (active) setItems(value);
      })
      .catch(() => {
        if (active) setError('Impossible de charger le stock. Réessayez.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reload]);
  const selected = items.find((item) => item.variantId === variantId);
  const count = Number(quantity);
  const validQuantity = Number.isSafeInteger(count) && count > 0 && count <= 1_000_000;
  const delta = direction === 'add' ? count : -count;
  const next = selected && validQuantity ? selected.stockQuantity + delta : undefined;
  const valid =
    !!selected &&
    validQuantity &&
    next !== undefined &&
    next >= 0 &&
    next <= 2_147_483_647 &&
    !!reason &&
    (reason !== 'Autre raison' || details.trim().length > 0);
  const visible = items.filter(
    (item) =>
      `${item.productName} ${item.sku}`
        .toLocaleLowerCase('fr')
        .includes(query.trim().toLocaleLowerCase('fr')) &&
      (filter === 'all' || (filter === 'empty' ? item.stockQuantity === 0 : item.isLow))
  );
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!valid || !selected || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    const body = {
      variantId,
      quantity: delta,
      note: reason + (details.trim() ? ` — ${details.trim()}` : '')
    };
    const fingerprint = JSON.stringify(body);
    if (attempt.current?.fingerprint !== fingerprint)
      attempt.current = { fingerprint, key: crypto.randomUUID() };
    try {
      const result = await adminRequest<{ variantId: string; stockQuantity: number }>(
        '/admin/inventory/adjust',
        {
          method: 'PATCH',
          body: JSON.stringify({ ...body, requestKey: attempt.current.key })
        }
      );
      setItems((current) =>
        current.map((item) =>
          item.variantId === result.variantId
            ? {
                ...item,
                stockQuantity: result.stockQuantity,
                isLow: result.stockQuantity <= item.lowStockThreshold
              }
            : item
        )
      );
      setMessage(
        `${selected.productName} : ${count} unité(s) ${direction === 'add' ? 'ajoutée(s)' : 'retirée(s)'}. Stock disponible : ${result.stockQuantity}.`
      );
      setQuantity('');
      setReason('');
      setDetails('');
      attempt.current = undefined;
      setHistoryRevision((value) => value + 1);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Modification impossible. Vérifiez le stock avant de réessayer.'
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <AdminPageHeader
        eyebrow="Votre inventaire"
        title="Stock"
        description="Repérez les produits à réapprovisionner et enregistrez les entrées ou sorties en quelques clics."
      />
      <section className="admin-stock-intro">
        <AdminIcon name="stock" size={32} />
        <div>
          <h2>Le bon stock, au bon moment.</h2>
          <p>
            Les commandes réservent les articles automatiquement. Utilisez cette page pour les
            livraisons reçues, les pertes ou les corrections après comptage.
          </p>
        </div>
      </section>
      {error && <p role="alert">{error}</p>}
      {message && (
        <p className="admin-success" role="status">
          {message}
        </p>
      )}
      {loading ? (
        <AdminLoading label="Chargement du stock…" />
      ) : (
        <>
          <section className="admin-stock-metrics" aria-label="Résumé du stock">
            {[
              ['products', items.length, 'Références suivies'],
              ['stock', items.filter((i) => i.isLow && i.stockQuantity > 0).length, 'Stock faible'],
              ['orders', items.filter((i) => i.stockQuantity === 0).length, 'En rupture']
            ].map(([icon, value, label]) => (
              <article key={label} className="admin-panel">
                <AdminIcon name={icon as 'products' | 'stock' | 'orders'} />
                <strong>{value}</strong>
                <span>{label}</span>
              </article>
            ))}
          </section>
          <section className="admin-panel">
            <header>
              <div>
                <h2>Disponibilité des produits</h2>
                <p>Choisissez un article pour ajuster sa quantité.</p>
              </div>
              <button
                className="admin-secondary-button"
                disabled={busy}
                onClick={() => setReload((value) => value + 1)}
              >
                <AdminIcon name="refresh" />
                Actualiser
              </button>
            </header>
            <div className="admin-toolbar">
              <label>
                Rechercher un produit
                <input
                  type="search"
                  placeholder="Nom ou référence…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              <label>
                Disponibilité
                <select value={filter} onChange={(e) => setFilter(e.target.value)}>
                  <option value="all">Tous les produits</option>
                  <option value="low">À réapprovisionner</option>
                  <option value="empty">En rupture</option>
                </select>
              </label>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Produit</th>
                    <th>Disponible</th>
                    <th>État du stock</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((item) => (
                    <tr key={item.variantId}>
                      <td data-label="Produit">
                        <strong>{item.productName}</strong>
                        <small>{item.sku}</small>
                      </td>
                      <td data-label="Disponible">
                        <strong>{item.stockQuantity}</strong> unités
                        <small>Alerte à {item.lowStockThreshold} unités</small>
                      </td>
                      <td data-label="État du stock">
                        <StatusBadge
                          tone={
                            item.stockQuantity === 0 ? 'danger' : item.isLow ? 'warning' : 'success'
                          }
                        >
                          {item.stockQuantity === 0
                            ? 'En rupture'
                            : item.isLow
                              ? 'Stock faible'
                              : 'Disponible'}
                        </StatusBadge>
                      </td>
                      <td data-label="Action">
                        <button
                          className="admin-secondary-button"
                          disabled={busy}
                          aria-label={`Ajuster ${item.productName}`}
                          onClick={() => {
                            setVariantId(item.variantId);
                            productSelect.current?.focus();
                            productSelect.current?.scrollIntoView({ block: 'center' });
                          }}
                        >
                          <AdminIcon name="stock" />
                          Ajuster
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!visible.length && (
              <div className="admin-empty">
                <AdminIcon name="products" />
                <h3>{items.length ? 'Aucun résultat' : 'Aucun produit en stock à gérer'}</h3>
                <p>
                  {items.length
                    ? 'Essayez un autre nom ou filtre.'
                    : 'Ajoutez un produit au catalogue pour commencer.'}
                </p>
              </div>
            )}
          </section>
          {!!items.length && (
            <form className="admin-stock-editor" onSubmit={(event) => void submit(event)}>
              <section className="admin-panel admin-form-section">
                <header>
                  <div>
                    <h2>
                      <AdminIcon name="stock" />
                      Mettre à jour une quantité
                    </h2>
                    <p>
                      1. Choisissez l’article · 2. Indiquez le changement · 3. Vérifiez et
                      enregistrez.
                    </p>
                  </div>
                </header>
                <fieldset disabled={busy} className="admin-stock-fields">
                  <label>
                    Produit à modifier
                    <select
                      ref={productSelect}
                      required
                      value={variantId}
                      onChange={(e) => setVariantId(e.target.value)}
                    >
                      <option value="">Choisir un produit</option>
                      {items.map((item) => (
                        <option key={item.variantId} value={item.variantId}>
                          {item.productName} — {item.sku}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div
                    className="admin-stock-direction"
                    role="group"
                    aria-label="Type de modification"
                  >
                    <button
                      type="button"
                      aria-pressed={direction === 'add'}
                      onClick={() => {
                        setDirection('add');
                        setReason('');
                      }}
                    >
                      <AdminIcon name="plus" />
                      <strong>Ajouter du stock</strong>
                      <span>Une entrée de produits</span>
                    </button>
                    <button
                      type="button"
                      aria-pressed={direction === 'remove'}
                      onClick={() => {
                        setDirection('remove');
                        setReason('');
                      }}
                    >
                      <AdminIcon name="arrow" />
                      <strong>Retirer du stock</strong>
                      <span>Une sortie de produits</span>
                    </button>
                  </div>
                  <div className="admin-form-grid">
                    <label>
                      Nombre d’unités à {direction === 'add' ? 'ajouter' : 'retirer'}
                      <input
                        type="number"
                        min="1"
                        max={
                          direction === 'remove' && selected
                            ? Math.min(selected.stockQuantity, 1_000_000)
                            : 1_000_000
                        }
                        step="1"
                        required
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        placeholder="Ex. : 5"
                      />
                      <small>Saisissez toujours un nombre positif.</small>
                    </label>
                    <label>
                      Pourquoi modifiez-vous le stock ?
                      <select required value={reason} onChange={(e) => setReason(e.target.value)}>
                        <option value="">Choisir une raison</option>
                        {reasons[direction].map((value) => (
                          <option key={value}>{value}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label>
                    Précisions {reason === 'Autre raison' ? '(obligatoires)' : '(facultatives)'}
                    <textarea
                      maxLength={400}
                      rows={3}
                      required={reason === 'Autre raison'}
                      value={details}
                      onChange={(e) => setDetails(e.target.value)}
                      placeholder="Ex. : 5 téléphones reçus du fournisseur, bon de livraison n° 124."
                    />
                  </label>
                  <p className="admin-settings-note">
                    <AdminIcon name="shield" />
                    La raison permet de comprendre pourquoi le stock a changé. Elle est conservée
                    avec la modification.
                  </p>
                </fieldset>
              </section>
              <aside className="admin-panel admin-stock-preview">
                <h2>
                  <AdminIcon name="eye" />
                  Vérifier avant d’enregistrer
                </h2>
                <p>
                  {selected?.productName || 'Choisissez un produit pour afficher le récapitulatif.'}
                </p>
                <dl>
                  <div>
                    <dt>Disponible actuellement</dt>
                    <dd>{selected ? selected.stockQuantity : '—'}</dd>
                  </div>
                  <div>
                    <dt>{direction === 'add' ? 'À ajouter' : 'À retirer'}</dt>
                    <dd>{validQuantity ? `${direction === 'add' ? '+' : '−'}${count}` : '—'}</dd>
                  </div>
                  <div className="admin-stock-result">
                    <dt>Stock prévu après modification</dt>
                    <dd aria-live="polite">{next ?? '—'}</dd>
                  </div>
                </dl>
                {next !== undefined && next < 0 && (
                  <p role="alert">
                    Vous ne pouvez pas retirer plus d’articles que le stock disponible.
                  </p>
                )}
                <small>
                  Le stock peut évoluer si une commande arrive. Le serveur vérifie la disponibilité
                  à l’enregistrement.
                </small>
                <button className="admin-primary-button" type="submit" disabled={!valid || busy}>
                  <AdminIcon name="check" />
                  {busy ? 'Enregistrement…' : 'Enregistrer le changement'}
                </button>
                <button
                  className="admin-secondary-button"
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setQuantity('');
                    setReason('');
                    setDetails('');
                    setError('');
                  }}
                >
                  Effacer la saisie
                </button>
              </aside>
            </form>
          )}
        </>
      )}
      <AdminStockHistory revision={historyRevision + reload} />
    </>
  );
}
