'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { adminRequest } from '../lib/admin-api';
import { formatMillimes, type ApiProduct, type ApiCategory } from '../lib/api';
import { orderLabels } from '../lib/orders';
import { governorates } from '../lib/checkout-validation';
import { AdminLoading, AdminPageHeader } from './admin-ui';
import { downloadCsv } from '../lib/report-export';

type Report = {
  summary: Record<string, number>;
  orders: Array<{
    id: string;
    reference: string;
    status: string;
    paymentStatus: string;
    totalMillimes: number;
    createdAt: string;
    collected: number;
    received: number;
    refunded: number;
  }>;
  days: Array<{ day: string; count: number; total: number }>;
  top: Array<{ name: string; quantity: number; total: number }>;
};
export const paymentLabels: Record<string, string> = {
  pending: 'À encaisser',
  collected: 'Collecté par le livreur',
  received: 'Reçu par la boutique',
  partially_refunded: 'Remboursé en partie',
  refunded: 'Remboursé'
};
export function AdminReports() {
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [productSearch, setProductSearch] = useState('');
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      void adminRequest<ApiProduct[]>(
        `/admin/products?limit=100&q=${encodeURIComponent(productSearch)}`
      )
        .then((p) => {
          if (active) setProducts(p);
        })
        .catch(() => {
          if (active) setProducts([]);
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [productSearch]);
  useEffect(() => {
    void adminRequest<ApiCategory[]>('/admin/categories')
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);
  const [filters, setFilters] = useState<Record<string, string>>({ basis: 'order' });
  const [offset, setOffset] = useState(0);
  const [report, setReport] = useState<Report>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const query = new URLSearchParams({ ...filters, offset: String(offset) }).toString();
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    adminRequest<Report>(`/admin/reports?${query}`)
      .then((value) => {
        if (active) setReport(value);
      })
      .catch((e: unknown) => {
        if (active) setError(e instanceof Error ? e.message : 'Rapport indisponible');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [query, revision]);
  function preset(days: number) {
    const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Tunis' }));
    const end = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    today.setDate(days === 0 ? 1 : today.getDate() - days + 1);
    const start = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    setFilters({ ...filters, from: start, to: end });
    setOffset(0);
  }
  return (
    <>
      <AdminPageHeader
        eyebrow="Pilotage"
        title="Ventes et encaissements"
        description="Des chiffres distincts pour vos commandes, vos livraisons et votre trésorerie."
      />
      <div className="admin-toolbar">
        <button onClick={() => preset(1)}>Aujourd’hui</button>
        <button onClick={() => preset(7)}>7 jours</button>
        <button onClick={() => preset(0)}>Ce mois</button>
        <button
          onClick={() => {
            setFilters({ basis: 'order' });
            setOffset(0);
          }}
        >
          Tout afficher
        </button>
      </div>
      <form
        className="admin-panel report-filters"
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          const next: Record<string, string> = {};
          for (const [key, value] of data)
            if (typeof value === 'string' && value) next[key] = value;
          setFilters(next);
          setOffset(0);
          setRevision((v) => v + 1);
        }}
        key={JSON.stringify(filters)}
      >
        <label>
          Du
          <input type="date" name="from" defaultValue={filters.from} />
        </label>
        <label>
          Au
          <input type="date" name="to" defaultValue={filters.to} />
        </label>
        <label>
          Date utilisée
          <select name="basis" defaultValue={filters.basis}>
            <option value="order">Création de commande</option>
            <option value="delivery">Première livraison</option>
            <option value="collection">Première collecte</option>
          </select>
        </label>
        <label>
          Commande
          <select name="status" defaultValue={filters.status}>
            <option value="">Tous les statuts</option>
            {Object.entries(orderLabels).map(([k, v]) => (
              <option value={k} key={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label>
          Paiement
          <select name="payment" defaultValue={filters.payment}>
            <option value="">Tous les paiements</option>
            {Object.entries(paymentLabels).map(([k, v]) => (
              <option value={k} key={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label>
          Mode de paiement
          <select name="method" defaultValue={filters.method}>
            <option value="">Tous</option>
            <option value="cash_on_delivery">Espèces à la livraison</option>
            <option value="online_card">Carte</option>
          </select>
        </label>
        <label>
          Gouvernorat
          <select name="governorate" defaultValue={filters.governorate}>
            <option value="">Tous</option>
            {governorates.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
        </label>
        <label>
          Catégorie
          <select name="category" defaultValue={filters.category}>
            <option value="">Toutes</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Rechercher un produit
          <input
            type="search"
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)}
            placeholder="Nom ou référence"
          />
          <small>100 résultats maximum ; précisez la recherche.</small>
        </label>
        <label>
          Produit
          <select name="product" defaultValue={filters.product}>
            <option value="">Tous</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Référence / téléphone
          <input name="q" defaultValue={filters.q} maxLength={100} />
        </label>
        <div className="admin-form-actions">
          <button className="admin-primary-button" disabled={loading}>
            Appliquer
          </button>
        </div>
      </form>
      <p className="report-explanation">
        Dates en heure de Tunis. Les montants sont les soldes actuels des commandes sélectionnées,
        livraison incluse, pas les flux bancaires de la période. Une commande retournée est exclue
        des ventes livrées. Le bénéfice n’est pas calculé.
      </p>
      {error && <p role="alert">{error}</p>}
      {loading ? (
        <AdminLoading label="Calcul du rapport…" />
      ) : (
        !error &&
        report && (
          <>
            <div className="report-metrics sales-metrics">
              {Object.entries({
                placed: 'Commandes reçues',
                delivered: 'Ventes livrées',
                received: 'Reçu par la boutique',
                awaitingRemittance: 'À reverser par le livreur',
                awaitingCollection: 'Livré, restant à encaisser',
                refunded: 'Remboursements',
                average: 'Panier moyen livré'
              }).map(([key, label]) => (
                <article className="admin-panel" key={key}>
                  <span>{label}</span>
                  <strong>{formatMillimes(Number(report.summary[key] ?? 0))} DT</strong>
                </article>
              ))}
            </div>
            <p>
              {report.summary.count} commande(s) · {report.summary.cancelled} annulée(s) ·{' '}
              {report.summary.returned} retournée(s)
            </p>
            <div className="report-columns">
              <section className="admin-panel report-section">
                <h2>Historique par jour</h2>
                <p>Valeur des commandes selon la date choisie (366 jours affichés maximum).</p>
                {!report.days.length && <p>Aucune activité pour ces filtres.</p>}
                {report.days.map((d) => (
                  <div className="report-day" key={d.day}>
                    <span>{d.day}</span>
                    <meter
                      aria-label={`Valeur du ${d.day}`}
                      min={0}
                      max={Math.max(...report.days.map((x) => Number(x.total)), 1)}
                      value={Number(d.total)}
                    />
                    <strong>{formatMillimes(Number(d.total))} DT</strong>
                  </div>
                ))}
              </section>
              <section className="admin-panel report-section">
                <h2>Meilleures ventes livrées</h2>
                {!report.top.length && <p>Aucune vente livrée.</p>}
                {report.top.map((t) => (
                  <p key={t.name}>
                    <strong>{t.name}</strong>
                    <br />
                    {t.quantity} article(s) · {formatMillimes(Number(t.total))} DT
                  </p>
                ))}
              </section>
            </div>
            <section className="admin-panel report-section">
              <h2>Commandes du rapport</h2>
              <button
                className="admin-secondary-button"
                disabled={!report.orders.length}
                onClick={() =>
                  downloadCsv('commandes-page.csv', [
                    [
                      'Référence',
                      'Date',
                      'Statut',
                      'Paiement',
                      'Total DT',
                      'Reçu DT',
                      'Remboursé DT'
                    ],
                    ...report.orders.map((o) => [
                      o.reference,
                      o.createdAt,
                      orderLabels[o.status] ?? o.status,
                      paymentLabels[o.paymentStatus] ?? o.paymentStatus,
                      (o.totalMillimes / 1000).toFixed(3),
                      (Number(o.received) / 1000).toFixed(3),
                      (Number(o.refunded) / 1000).toFixed(3)
                    ])
                  ])
                }
              >
                Exporter cette page CSV (50 max.)
              </button>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Commande</th>
                      <th>Statut</th>
                      <th>Paiement</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.orders.map((o) => (
                      <tr key={o.id}>
                        <td>
                          <Link href={`/admin/commandes/${o.id}`}>{o.reference}</Link>
                        </td>
                        <td>{orderLabels[o.status]}</td>
                        <td>{paymentLabels[o.paymentStatus]}</td>
                        <td>{formatMillimes(o.totalMillimes)} DT</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!report.orders.length && <p>Aucune commande trouvée.</p>}
              <div className="admin-toolbar">
                <button disabled={offset === 0} onClick={() => setOffset((v) => v - 50)}>
                  Précédent
                </button>
                <span>Page {offset / 50 + 1}</span>
                <button
                  disabled={offset + 50 >= (report.summary.count ?? 0)}
                  onClick={() => setOffset((v) => v + 50)}
                >
                  Suivant
                </button>
              </div>
            </section>
          </>
        )
      )}
    </>
  );
}
