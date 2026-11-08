import { orderLabels } from '../lib/orders';
export interface TrackingResult {
  reference: string;
  status: string;
  createdAt?: string;
  history?: Array<{ status: string; at: string }>;
}
const steps = ['pending', 'confirmed', 'preparing', 'shipped', 'delivered'];
export function OrderTimeline({ result }: { result: TrackingResult }) {
  const current = steps.indexOf(result.status);
  return (
    <section className="tracking-result" aria-label="État de votre commande">
      <p className="section-kicker">Votre commande</p>
      <h2>{result.reference}</h2>
      <p role="status" className="tracking-status">
        {orderLabels[result.status] ?? 'Statut indisponible'}
      </p>
      {current >= 0 ? (
        <ol className="order-timeline">
          {steps.map((status, index) => (
            <li
              key={status}
              data-complete={index <= current}
              aria-current={index === current ? 'step' : undefined}
            >
              <span aria-hidden="true">{index < current ? '✓' : index + 1}</span>
              <div>
                <strong>{status === 'pending' ? 'Commande reçue' : orderLabels[status]}</strong>
                {result.history?.find((h) => h.status === status) && (
                  <small>
                    {new Intl.DateTimeFormat('fr-TN', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                      timeZone: 'Africa/Tunis'
                    }).format(new Date(result.history.find((h) => h.status === status)!.at))}
                  </small>
                )}
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p>
          {result.status === 'cancelled'
            ? 'Cette commande a été annulée.'
            : result.status === 'returned'
              ? 'Le retour de cette commande a été enregistré.'
              : 'Contactez la boutique pour connaître la prochaine étape.'}
        </p>
      )}
      <p>
        Statut mis à jour par la boutique. Il ne s’agit pas d’une localisation en direct du livreur.
      </p>
      <a className="secondary-button" href="/contact">
        Contacter la boutique
      </a>
    </section>
  );
}
