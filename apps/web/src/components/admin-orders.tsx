'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { adminRequest } from '../lib/admin-api';
import { formatMillimes } from '../lib/api';
import { orderLabels, orderTransitions, type ApiOrder } from '../lib/orders';
import { AdminIcon } from './admin-icon';
import { AdminOrderFinance } from './admin-order-finance';
import { AdminDeliveryNotes } from './admin-delivery-notes';
import { AdminPageHeader, AdminLoading, StatusBadge } from './admin-ui';

export function AdminOrders() {
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  function toggle(id: string) {
    setSelected((ids) =>
      ids.includes(id) ? ids.filter((value) => value !== id) : ids.length < 50 ? [...ids, id] : ids
    );
  }
  const wholePageSelected =
    orders.length > 0 && orders.every((order) => selected.includes(order.id));
  const pageExceedsLimit = new Set([...selected, ...orders.map((order) => order.id)]).size > 50;
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    const timeout = setTimeout(() => {
      adminRequest<ApiOrder[]>(
        `/admin/orders?limit=30&offset=${offset}&q=${encodeURIComponent(query)}&status=${status}${from ? `&from=${from}` : ''}${to ? `&to=${to}` : ''}`
      )
        .then((data) => {
          if (active) setOrders(data);
        })
        .catch((reason: unknown) => {
          if (active) setError(reason instanceof Error ? reason.message : 'Chargement impossible');
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 200);
    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [query, status, offset, revision, from, to]);
  return (
    <>
      <AdminPageHeader
        eyebrow="Ventes"
        title="Commandes"
        description="Confirmez, préparez et suivez vos commandes."
      />
      <section className="admin-toolbar">
        <label>
          Rechercher
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setOffset(0);
              setSelected([]);
            }}
            placeholder="Référence, nom ou téléphone"
          />
        </label>
        <label>
          Statut
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setOffset(0);
              setSelected([]);
            }}
          >
            <option value="">Tous</option>
            {Object.entries(orderLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Commandes du
          <input
            type="date"
            value={from}
            max={to || undefined}
            onChange={(event) => {
              setFrom(event.target.value);
              setOffset(0);
              setSelected([]);
            }}
          />
        </label>
        <label>
          Au (inclus)
          <input
            type="date"
            value={to}
            min={from || undefined}
            onChange={(event) => {
              setTo(event.target.value);
              setOffset(0);
              setSelected([]);
            }}
          />
        </label>
        <button
          className="admin-secondary-button"
          onClick={() => setRevision((value) => value + 1)}
        >
          <AdminIcon name="refresh" /> Actualiser
        </button>
      </section>
      {error ? (
        <p role="alert">
          {error} <Link href="/admin/connexion">Se reconnecter</Link>
        </p>
      ) : null}
      {loading ? (
        <AdminLoading label="Chargement des commandes…" />
      ) : (
        <section className="admin-panel">
          <div className="orders-selection-toolbar">
            <label className="order-select">
              <input
                type="checkbox"
                aria-label="Sélectionner cette page"
                checked={wholePageSelected}
                disabled={!orders.length || !!error || (pageExceedsLimit && !wholePageSelected)}
                onChange={(event) =>
                  setSelected((ids) =>
                    event.target.checked
                      ? [...new Set([...ids, ...orders.map((order) => order.id)])]
                      : ids.filter((id) => !orders.some((order) => order.id === id))
                  )
                }
              />
              Sélectionner cette page
            </label>
            <span role="status">{selected.length}/50 commande(s) sélectionnée(s)</span>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table orders-table">
              <thead>
                <tr>
                  <th>Sélection</th>
                  <th>Commande</th>
                  <th>Client</th>
                  <th>Total</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td data-label="Sélection">
                      <label className="order-select">
                        <input
                          type="checkbox"
                          aria-label={`Sélectionner ${order.reference}`}
                          checked={selected.includes(order.id)}
                          disabled={selected.length >= 50 && !selected.includes(order.id)}
                          onChange={() => toggle(order.id)}
                        />
                      </label>
                    </td>
                    <td data-label="Commande">
                      <Link href={`/admin/commandes/${order.id}`}>{order.reference}</Link>
                      <small>
                        {new Date(order.createdAt).toLocaleString('fr-TN', {
                          timeZone: 'Africa/Tunis'
                        })}
                      </small>
                    </td>
                    <td data-label="Client">
                      {order.customer.firstName} {order.customer.lastName}
                      <small>
                        {order.customer.phone} · {order.customer.governorate}
                      </small>
                    </td>
                    <td data-label="Total">{formatMillimes(order.totalMillimes)} DT</td>
                    <td data-label="Statut">
                      <StatusBadge
                        tone={
                          order.status === 'pending'
                            ? 'warning'
                            : order.status === 'delivered'
                              ? 'success'
                              : 'info'
                        }
                      >
                        {orderLabels[order.status] ?? order.status}
                      </StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!orders.length ? <p className="empty-state">Aucune commande trouvée.</p> : null}
        </section>
      )}
      <div className="admin-toolbar">
        <button
          disabled={offset === 0 || loading}
          onClick={() => setOffset(Math.max(0, offset - 30))}
        >
          Précédent
        </button>
        <button disabled={orders.length < 30 || loading} onClick={() => setOffset(offset + 30)}>
          Suivant
        </button>
      </div>
      <AdminDeliveryNotes
        key={`${selected.join(',')}:${from}:${to}:${status}:${revision}`}
        selected={selected}
        from={from}
        to={to}
        status={status}
        clearSelection={() => setSelected([])}
      />
    </>
  );
}

export function AdminOrderDetail({ id }: Readonly<{ id: string }>) {
  const [order, setOrder] = useState<ApiOrder>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    adminRequest<ApiOrder>(`/admin/orders/${id}`)
      .then(setOrder)
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : 'Chargement impossible')
      );
  }, [id]);
  async function update(status: string) {
    setBusy(true);
    setError('');
    setSaved(false);
    try {
      await adminRequest<ApiOrder>(`/admin/orders/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
      setOrder(await adminRequest<ApiOrder>(`/admin/orders/${id}`));
      setSaved(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Modification impossible');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Link href="/admin/commandes">← Retour aux commandes</Link>
      {error ? <p role="alert">{error}</p> : null}
      {!order ? (
        error ? null : (
          <AdminLoading label="Chargement de la commande…" />
        )
      ) : (
        <>
          <AdminPageHeader
            eyebrow="Commande"
            title={order.reference}
            description={orderLabels[order.status] ?? order.status}
          />
          <ol className="admin-order-timeline" aria-label="Étapes de la commande">
            {['pending', 'confirmed', 'preparing', 'shipped', 'delivered'].map((step) => (
              <li key={step} aria-current={order.status === step ? 'step' : undefined}>
                <AdminIcon
                  name={step === 'delivered' ? 'check' : step === 'shipped' ? 'truck' : 'orders'}
                />
                {orderLabels[step]}
              </li>
            ))}
          </ol>
          {saved ? (
            <p className="admin-success" role="status">
              Statut enregistré.
            </p>
          ) : null}
          <div className="admin-order-grid">
            <section className="admin-panel admin-order-items">
              <header>
                <h2>Articles</h2>
              </header>
              {order.items?.map((item) => (
                <article key={item.id}>
                  <strong>{item.productName}</strong>
                  <span>Quantité : {item.quantity}</span>
                  <span>{formatMillimes(item.lineTotalMillimes)} DT</span>
                </article>
              ))}
              <p>Livraison : {formatMillimes(order.deliveryMillimes)} DT</p>
              <footer>
                <strong>Total : {formatMillimes(order.totalMillimes)} DT</strong>
              </footer>
              <div className="admin-toolbar">
                {(orderTransitions[order.status] ?? []).map((status) => (
                  <button
                    key={status}
                    className={
                      status === 'cancelled' ? 'admin-danger-button' : 'admin-primary-button'
                    }
                    disabled={busy}
                    onClick={() => {
                      if (
                        status === 'cancelled' &&
                        !window.confirm(
                          'Annuler cette commande et remettre les articles en stock ?'
                        )
                      )
                        return;
                      void update(status);
                    }}
                  >
                    <AdminIcon name={status === 'cancelled' ? 'close' : 'check'} />{' '}
                    {orderLabels[status]}
                  </button>
                ))}
              </div>
            </section>
            <aside className="admin-panel admin-detail-list">
              <header>
                <h2>Client et livraison</h2>
              </header>
              <p>
                {order.customer.firstName} {order.customer.lastName}
              </p>
              <p>{order.customer.phone}</p>
              <p>
                {order.customer.address}, {order.customer.governorate}
              </p>
              <p>
                {order.paymentMethod === 'cash_on_delivery'
                  ? 'Paiement à la livraison'
                  : 'Carte bancaire'}
              </p>
              <p>Consultez les encaissements et remboursements dans le registre ci-dessous.</p>
            </aside>
          </div>
          <AdminOrderFinance order={order} />
        </>
      )}
    </>
  );
}
