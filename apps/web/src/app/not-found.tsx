import Link from 'next/link';
import { PageShell } from '../components/page-shell';
export default function NotFound() {
  return (
    <PageShell>
      <div className="empty-state">
        <p className="section-kicker">Erreur 404</p>
        <h1>Cette page n’existe pas</h1>
        <p>Le lien est peut-être incorrect ou le produit n’est plus disponible.</p>
        <Link className="primary-button" href="/">
          Retour à l’accueil
        </Link>
      </div>
    </PageShell>
  );
}
