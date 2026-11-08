import { InfoPage } from '../../components/info-page';
export default function ReturnsPage() {
  return (
    <InfoPage kicker="Service après-vente" title="Retours et garantie" draft>
      <h2>Demander un retour</h2>
      <p>
        Contactez le magasin avec votre référence de commande avant tout renvoi. Les conditions
        applicables dépendent de l’état du produit et de la réglementation en vigueur.
      </p>
      <h2>Garantie</h2>
      <p>
        Conservez la facture et les accessoires. La durée et les exclusions propres à chaque article
        doivent figurer sur sa fiche.
      </p>
    </InfoPage>
  );
}
