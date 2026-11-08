import type { ReactNode } from 'react';
import { PageShell } from './page-shell';

export function InfoPage({
  kicker,
  title,
  children,
  draft = false
}: Readonly<{ kicker: string; title: string; children: ReactNode; draft?: boolean }>) {
  return (
    <PageShell>
      <article className="info-page">
        <header className="page-heading">
          <p className="section-kicker">{kicker}</p>
          <h1>{title}</h1>
          {draft ? (
            <p className="draft-badge">
              Contenu provisoire à valider par le commerçant avant publication.
            </p>
          ) : null}
        </header>
        {children}
      </article>
    </PageShell>
  );
}
