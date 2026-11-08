'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="container empty-state" role="alert">
      <h1>Cette page n’a pas pu être chargée</h1>
      <p>Votre panier est conservé. Réessayez dans quelques instants.</p>
      <button className="primary-button" onClick={reset}>
        Réessayer
      </button>
      <a className="secondary-button" href="/">
        Retour à l’accueil
      </a>
    </main>
  );
}
