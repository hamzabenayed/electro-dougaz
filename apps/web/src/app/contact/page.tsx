import { InfoPage } from '../../components/info-page';
import { PublicStoreSettings } from '../../components/public-store-settings';
export default function ContactPage() {
  return (
    <InfoPage kicker="Nous contacter" title="Comment pouvons-nous vous aider ?">
      <PublicStoreSettings />
      <div className="contact-options">
        <a className="secondary-button" href="/suivi-commande">
          Suivre une commande
        </a>
        <a className="secondary-button" href="/retours">
          Retours et garantie
        </a>
      </div>
    </InfoPage>
  );
}
