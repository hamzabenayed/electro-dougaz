'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import logo from '../../../../public/logo/logo-enhanced.png';
import { AdminIcon, type AdminIconName } from './admin-icon';
import { adminRequest } from '../lib/admin-api';
import { clearAdminToken, getAdminToken } from '../lib/admin-session';

const navigation: Array<{ href: string; label: string; icon: AdminIconName }> = [
  { href: '/admin/tableau-de-bord', label: 'Tableau de bord', icon: 'dashboard' },
  { href: '/admin/commandes', label: 'Commandes', icon: 'orders' },
  { href: '/admin/rapports', label: 'Ventes et paiements', icon: 'dashboard' },
  { href: '/admin/historique', label: 'Historique', icon: 'orders' },
  { href: '/admin/produits', label: 'Produits', icon: 'products' },
  { href: '/admin/promotions', label: 'Promotions', icon: 'products' },
  { href: '/admin/stock', label: 'Stock', icon: 'stock' },
  { href: '/admin/categories', label: 'Catégories', icon: 'categories' },
  { href: '/admin/parametres', label: 'Paramètres', icon: 'settings' }
];

export function AdminShell({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mobile, setMobile] = useState(false);
  const sidebar = useRef<HTMLElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 1040px)');
    const sync = () => {
      setMobile(media.matches);
      if (!media.matches) setOpen(false);
    };
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);
  useEffect(() => {
    if (!open || !mobile) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusable = () =>
      Array.from(
        sidebar.current?.querySelectorAll<HTMLElement>('a[href], button:not(:disabled)') ?? []
      );
    focusable()[0]?.focus();
    function keydown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        menuButton.current?.focus();
      }
      if (event.key === 'Tab') {
        const items = focusable(),
          first = items[0],
          last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener('keydown', keydown);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', keydown);
      menuButton.current?.focus();
    };
  }, [open, mobile]);
  const current = navigation.find((item) => pathname.startsWith(item.href));
  useEffect(() => {
    if (!getAdminToken()) router.replace('/admin/connexion');
  }, [router]);

  async function logout() {
    try {
      await adminRequest('/admin/auth/logout', { method: 'POST' });
    } finally {
      clearAdminToken();
      router.replace('/admin/connexion');
    }
  }
  return (
    <div className="admin-app">
      <a className="admin-skip-link" href="#admin-main">
        Aller au contenu
      </a>
      <button
        className={`admin-backdrop ${open ? 'is-visible' : ''}`}
        aria-label="Fermer le menu"
        tabIndex={-1}
        aria-hidden="true"
        onClick={() => setOpen(false)}
      />
      <aside
        ref={sidebar}
        id="admin-navigation"
        className={`admin-sidebar ${open ? 'is-open' : ''}`}
        inert={mobile && !open}
        aria-label="Menu de gestion"
      >
        <button
          type="button"
          className="admin-drawer-close"
          onClick={() => setOpen(false)}
          aria-label="Fermer la navigation"
        >
          <AdminIcon name="close" />
        </button>
        <Link className="admin-logo" href="/admin/tableau-de-bord">
          <Image src={logo} width={64} height={32} alt="" />
          <span>
            Electro <strong>Dougaz</strong>
            <small>Administration</small>
          </span>
        </Link>
        <p className="admin-nav-label">Votre espace de travail</p>
        <nav aria-label="Navigation d’administration">
          {navigation.map((item) => (
            <Link
              className={pathname.startsWith(item.href) ? 'active' : ''}
              aria-current={pathname.startsWith(item.href) ? 'page' : undefined}
              href={item.href}
              key={item.href}
              onClick={() => setOpen(false)}
            >
              <AdminIcon name={item.icon} />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="admin-sidebar-footer">
          <span className="admin-avatar">
            <AdminIcon name="shield" />
          </span>
          <span>
            <strong>Administration</strong>
            <small>Boutique</small>
          </span>
          <button
            type="button"
            aria-label="Se déconnecter"
            title="Se déconnecter"
            onClick={() => void logout().catch(() => undefined)}
          >
            <AdminIcon name="logout" />
          </button>
        </div>
      </aside>
      <div className="admin-workspace" inert={mobile && open}>
        <header className="admin-topbar">
          <button
            ref={menuButton}
            aria-expanded={open}
            aria-controls="admin-navigation"
            className="admin-menu-button"
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Ouvrir le menu"
          >
            <AdminIcon name="menu" />
          </button>
          <div>
            <small>Espace de gestion</small>
            <strong>{current?.label ?? 'Administration'}</strong>
          </div>
          <Link className="admin-topbar-add" href="/admin/produits/nouveau">
            <AdminIcon name="plus" />
            <span>Nouveau produit</span>
          </Link>

          <Link
            className="admin-store-link"
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Voir la boutique (nouvel onglet)"
          >
            <AdminIcon name="store" />
            <span>Voir la boutique</span>
          </Link>
        </header>
        <main id="admin-main" className="admin-content" tabIndex={-1}>
          <div key={pathname} className="admin-route-content">
            {children}
          </div>
        </main>
        <nav className="admin-mobile-nav" aria-label="Navigation mobile d’administration">
          {navigation.slice(0, 4).map((item) => (
            <Link
              className={pathname.startsWith(item.href) ? 'active' : ''}
              aria-current={pathname.startsWith(item.href) ? 'page' : undefined}
              href={item.href}
              key={item.href}
            >
              <AdminIcon name={item.icon} />
              <span>{item.label === 'Tableau de bord' ? 'Accueil' : item.label}</span>
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
