import { InfoPage } from '../../components/info-page';
export default function PrivacyPage() {
  return (
    <InfoPage kicker="Vos données" title="Politique de confidentialité" draft>
      <h2>Données traitées</h2>
      <p>
        La boutique utilisera uniquement les informations nécessaires au traitement, à la livraison
        et au suivi des commandes.
      </p>
      <h2>Durée et droits</h2>
      <p>
        Les durées de conservation, destinataires, mesures de sécurité et modalités d’exercice des
        droits doivent être renseignés avec le responsable du traitement avant publication.
      </p>
      <p>
        Les données de carte ne seront jamais saisies ni stockées par la boutique : le paiement en
        ligne sera effectué sur la page sécurisée du prestataire.
      </p>
    </InfoPage>
  );
}
