import Link from 'next/link';
import type { ReactNode } from 'react';
import { AdminIcon } from './admin-icon';

export function AdminPageHeader({
  eyebrow,
  title,
  description,
  action
}: Readonly<{
  eyebrow: string;
  title: string;
  description?: string;
  action?: { href: string; label: string };
}>) {
  return (
    <header className="admin-page-header">
      <div>
        <p>{eyebrow}</p>
        <h1>{title}</h1>
        {description ? <span>{description}</span> : null}
      </div>
      {action ? (
        <Link className="admin-primary-button" href={action.href}>
          <AdminIcon name="plus" />
          {action.label}
        </Link>
      ) : null}
    </header>
  );
}

export function StatusBadge({
  children,
  tone = 'neutral'
}: Readonly<{
  children: ReactNode;
  tone?: 'neutral' | 'info' | 'warning' | 'success' | 'danger';
}>) {
  return <span className={`admin-status status-${tone}`}>{children}</span>;
}

export function AdminEmptyState({
  title,
  children,
  action
}: Readonly<{ title: string; children: ReactNode; action?: { href: string; label: string } }>) {
  return (
    <div className="admin-empty">
      <span aria-hidden="true">
        <AdminIcon name="products" size={28} />
      </span>
      <h2>{title}</h2>
      <p>{children}</p>
      {action ? (
        <Link className="admin-primary-button" href={action.href}>
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}
export function AdminLoading({
  label = 'Chargement de votre espace…'
}: Readonly<{ label?: string }>) {
  return (
    <div className="admin-loading" role="status">
      <AdminIcon name="refresh" />
      <span>{label}</span>
    </div>
  );
}
