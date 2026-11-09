'use client';
import Image from 'next/image';
import logo from '../../../../public/logo/logo-enhanced.png';
import { formatMillimes } from '../lib/api';
import { orderLabels, type ApiOrder } from '../lib/orders';

export type DeliveryOrder = ApiOrder & { collectedMillimes: number; refundedMillimes: number };
export function OrderDocument({
  order,
  kind = 'delivery',
  collected = 0,
  refunded = 0,
  onLogoReady
}: {
  order: ApiOrder;
  kind?: 'summary' | 'delivery';
  collected?: number;
  refunded?: number;
  onLogoReady?: () => void;
}) {
  const canCollect =
    order.paymentMethod === 'cash_on_delivery' &&
    !['cancelled', 'returned', 'payment_failed'].includes(order.status);
  return (
    <article className="print-document branded-document">
      <header className="document-heading">
        <div className="document-brand">
          <Image
            src={logo}
            alt="Electro Dougaz"
            width={84}
            height={56}
            unoptimized
            onLoad={onLogoReady}
            onError={onLogoReady}
          />
          <strong>
            Electro <span>Dougaz</span>
          </strong>
        </div>
        <div>
          <p className="document-kicker">
            {kind === 'delivery' ? 'Bon de livraison' : 'Récapitulatif de commande'}
          </p>
          <strong>{order.reference}</strong>
          <p>
            Commande du{' '}
            {new Date(order.createdAt).toLocaleDateString('fr-TN', { timeZone: 'Africa/Tunis' })}
          </p>
        </div>
      </header>
      <div className="document-details">
        <section>
          <h3>Livrer à</h3>
          <strong>
            {order.customer.firstName} {order.customer.lastName}
          </strong>
          <p>{order.customer.phone}</p>
          <p>
            {order.customer.address}
            <br />
            {order.customer.governorate}
          </p>
        </section>
        <section>
          <h3>Suivi de commande</h3>
          <strong>{orderLabels[order.status] ?? order.status}</strong>
          <p>
            {order.paymentMethod === 'cash_on_delivery'
              ? 'Paiement en espèces à la livraison'
              : 'Paiement par carte'}
          </p>
          <p>{order.items?.reduce((total, item) => total + item.quantity, 0) ?? 0} article(s)</p>
        </section>
      </div>
      <table>
        <thead>
          <tr>
            <th>Article / référence</th>
            <th>Qté</th>
            {kind === 'summary' && <th>Total (DT)</th>}
          </tr>
        </thead>
        <tbody>
          {order.items?.map((item) => (
            <tr key={item.id}>
              <td>
                <strong>{item.productName}</strong>
                {item.sku && <small>{item.sku}</small>}
              </td>
              <td>{item.quantity}</td>
              {kind === 'summary' && <td>{formatMillimes(item.lineTotalMillimes)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="document-totals">
        <div>
          <dt>Frais de livraison</dt>
          <dd>{formatMillimes(order.deliveryMillimes)} DT</dd>
        </div>
        <div>
          <dt>Total de la commande</dt>
          <dd>{formatMillimes(order.totalMillimes)} DT</dd>
        </div>
        <div>
          <dt>Déjà collecté</dt>
          <dd>{formatMillimes(collected)} DT</dd>
        </div>
        {refunded > 0 && (
          <div>
            <dt>Remboursé au client</dt>
            <dd>{formatMillimes(refunded)} DT</dd>
          </div>
        )}
        {canCollect ? (
          <div className="document-balance">
            <dt>Reste à collecter</dt>
            <dd>{formatMillimes(Math.max(0, order.totalMillimes - collected))} DT</dd>
          </div>
        ) : (
          <div>
            <dt>Encaissement</dt>
            <dd>
              {['cancelled', 'returned'].includes(order.status)
                ? 'Ne pas encaisser'
                : 'Vérifier le paiement'}
            </dd>
          </div>
        )}
      </dl>
      {kind === 'delivery' && (
        <div className="document-signatures">
          <section>
            <strong>Remis par le livreur</strong>
            <p>Nom et signature</p>
            <div />
          </section>
          <section>
            <strong>Réceptionné par le client</strong>
            <p>Date : ____ / ____ / ______</p>
            <p>Signature</p>
            <div />
          </section>
        </div>
      )}
      <footer>
        Merci pour votre confiance. <strong>Electro Dougaz</strong>
        <br />
        <small>
          Document de suivi — ne constitue pas une facture fiscale ni une preuve de paiement.
        </small>
      </footer>
    </article>
  );
}
