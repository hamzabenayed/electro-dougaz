import type { ReactNode } from 'react';
import { InnerHeader } from './inner-header';
import { SiteFooter } from './site-footer';

export function PageShell({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="site-shell">
      <InnerHeader />
      <main className="page-main container">{children}</main>
      <SiteFooter />
    </div>
  );
}
