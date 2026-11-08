'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { adminRequest } from '../lib/admin-api';
import { orderLabels, type ApiOrder } from '../lib/orders';
import { formatMillimes } from '../lib/api';
import { AdminIcon } from './admin-icon';
import { AdminPageHeader, AdminLoading, StatusBadge } from './admin-ui';

export interface InventoryRow {
  variantId: string;
  productId: string;
  productName: string;
  sku: string;
  stockQuantity: number;
  lowStockThreshold: number;
  isLow: boolean;
}

export function AdminOverview() {
  const [orders, setOrders] = useState<ApiOrder[]>();
  const [stock, setStock] = useState<InventoryRow[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    Promise.all([
      adminRequest<ApiOrder[]>('/admin/orders?limit=100'),
      adminRequest<InventoryRow[]>('/admin/inventory')
    ])
      .then(([data, inventory]) => {
        setOrders(data);
        setStock(inventory);
      })
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : 'Chargement impossible')
      );
  }, []);
  const pending = orders?.filter((order) => order.status === 'pending').length ?? 0;
  const preparing =
    orders?.filter((order) => ['confirmed', 'preparing'].includes(order.status)).length ?? 0;
  const lowStock = stock.filter((item) => item.isLow).length;
  return (
    <>
      <AdminPageHeader
        eyebrow="Votre boutique, en un regard"
        title="Tableau de bord"
        description="Les bonnes informations pour bien commencer votre journée."
        action={{ href: '/admin/produits/nouveau', label: 'Ajouter un produit' }}
      />
      <p>
        <Link href="/admin/rapports">
          Consulter les ventes, encaissements et rapports par période →
        </Link>
      </p>
      {error ? (
        <p role="alert">{error}</p>
      ) : !orders ? (
        <AdminLoading />
      ) : (
        <>
          <section className="admin-welcome">
            <div>
              <h2>Chaque journée commence ici.</h2>
              <p>
                {pending
                  ? `${pending} commande(s) attendent votre confirmation. Un petit geste pour lancer la suite.`
                  : 'Vos dernières commandes et vos priorités, réunies dans un espace simple.'}
              </p>
              <Link href="/admin/commandes">
                Gérer les commandes <AdminIcon name="arrow" />
              </Link>
            </div>
            <AdminIcon name="store" size={90} />
          </section>
          <section className="admin-metrics" aria-label="Indicateurs de gestion">
            <article className="admin-metric">
              <span>À confirmer</span>
              <strong>{pending}</strong>
              <span className="admin-section-icon">
                <AdminIcon name="clock" />
              </span>
              <small>Sur les 100 dernières commandes</small>
            </article>
            <article className="admin-metric">
              <span>En préparation</span>
              <strong>{preparing}</strong>
              <span className="admin-section-icon">
                <AdminIcon name="orders" />
              </span>
              <small>Confirmées ou en préparation · 100 dernières</small>
            </article>
            <article className="admin-metric">
              <span>Stock faible</span>
              <strong>{lowStock}</strong>
              <span className="admin-section-icon">
                <AdminIcon name="stock" />
              </span>
              <small>Références à réapprovisionner</small>
            </article>
          </section>
          <div className="admin-dashboard-grid">
            <section className="admin-panel">
              <header>
                <div>
                  <h2>Commandes récentes</h2>
                  <p>Gardez le rythme de votre boutique.</p>
                </div>
                <Link href="/admin/commandes">
                  Tout voir <AdminIcon name="arrow" />
                </Link>
              </header>
              {!orders.length ? (
                <div className="admin-empty">
                  <span>
                    <AdminIcon name="orders" />
                  </span>
                  <p>Aucune commande pour le moment.</p>
                  <Link className="admin-secondary-button" href="/">
                    Voir la boutique
                  </Link>
                </div>
              ) : (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Référence</th>
                        <th>Total</th>
                        <th>Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.slice(0, 6).map((order) => (
                        <tr key={order.id}>
                          <td data-label="Référence">
                            <Link href={`/admin/commandes/${order.id}`}>{order.reference}</Link>
                            <small>
                              {order.customer.firstName} {order.customer.lastName}
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
              )}
            </section>
            <div className="admin-quick-links">
              <section className="admin-panel">
                <header>
                  <div>
                    <h2>Vos raccourcis</h2>
                    <p>Les actions utiles, à portée de main.</p>
                  </div>
                </header>
                <div className="admin-quick-links">
                  <Link className="admin-quick-link" href="/admin/produits/nouveau">
                    <AdminIcon name="plus" />
                    <span>
                      <strong>Ajouter un produit</strong>
                      <small>Enrichir votre catalogue</small>
                    </span>
                    <AdminIcon name="arrow" />
                  </Link>
                  <Link className="admin-quick-link" href="/admin/categories">
                    <AdminIcon name="categories" />
                    <span>
                      <strong>Organiser les catégories</strong>
                      <small>Faciliter la recherche des clients</small>
                    </span>
                    <AdminIcon name="arrow" />
                  </Link>
                </div>
              </section>
              <section className="admin-panel">
                <header>
                  <div>
                    <h2>Stock faible</h2>
                    <p>{lowStock} référence(s) à surveiller.</p>
                  </div>
                  <span className="admin-section-icon">
                    <AdminIcon name="stock" />
                  </span>
                </header>
                <Link className="admin-quick-link" href="/admin/stock">
                  <span>
                    <strong>Vérifier le stock</strong>
                    <small>Anticiper les ruptures</small>
                  </span>
                  <AdminIcon name="arrow" />
                </Link>
              </section>
            </div>
          </div>
        </>
      )}
    </>
  );
}

export { AdminInventory } from './admin-inventory';
