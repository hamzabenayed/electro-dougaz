import { InfoPage } from '../../components/info-page';
import { PublicStoreSettings } from '../../components/public-store-settings';
export default function DeliveryPage() {
  return (
    <InfoPage kicker="Informations pratiques" title="Livraison et paiement">
      <h2>Livraison en Tunisie</h2>
      <PublicStoreSettings delivery />
      <h2>Paiement</h2>
      <p>
        Le client pourra choisir le paiement en espèces à la livraison ou le paiement par carte
        lorsque ClicToPay sera activé.
      </p>
      <h2>Réception</h2>
      <p>
        Vérifiez l’état apparent du colis lors de sa remise et contactez le magasin rapidement en
        cas d’anomalie.
      </p>
    </InfoPage>
  );
}
