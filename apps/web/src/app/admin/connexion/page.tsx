'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import logo from '../../../../../../public/logo/logo-enhanced.png';
import { apiRequest } from '../../../lib/api';
import { AdminIcon } from '../../../components/admin-icon';
import { setAdminToken } from '../../../lib/admin-session';

export default function AdminLoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);
    const data = new FormData(event.currentTarget);
    try {
      const result = await apiRequest<{ token: string }>('/admin/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: data.get('email'), password: data.get('password') })
      });
      setAdminToken(result.token);
      router.replace('/admin/tableau-de-bord');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Connexion impossible.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="admin-login">
      <section className="admin-login-brand">
        <div>
          <div className="admin-login-brand-row">
            <Image src={logo} width={112} height={56} alt="" />
            <span>
              Electro <strong>Dougaz</strong>
            </span>
          </div>
          <span className="admin-login-overline">VOTRE BOUTIQUE, SOUS CONTRÔLE</span>
          <div className="admin-login-features">
            <div>
              <AdminIcon name="orders" />
              <span>
                <strong>Chaque commande, au bon endroit</strong>
                <small>De la confirmation à la livraison.</small>
              </span>
            </div>
            <div>
              <AdminIcon name="products" />
              <span>
                <strong>Un catalogue toujours à jour</strong>
                <small>Articles, prix et disponibilité.</small>
              </span>
            </div>
            <div>
              <AdminIcon name="stock" />
              <span>
                <strong>Une longueur d’avance sur le stock</strong>
                <small>Repérez les produits à réapprovisionner.</small>
              </span>
            </div>
          </div>
        </div>
      </section>
      <section className="admin-login-panel">
        <form className="admin-login-form" onSubmit={(event) => void submit(event)}>
          <div className="admin-login-emblem">
            <AdminIcon name="shield" size={28} />
          </div>
          <p className="admin-eyebrow">Bienvenue dans votre espace</p>
          <h1>Se connecter</h1>
          <p>Utilisez votre accès professionnel.</p>
          <label>
            Adresse e-mail
            <input
              type="email"
              name="email"
              autoComplete="username"
              placeholder="nom@entreprise.tn"
              required
            />
          </label>
          <label htmlFor="admin-password">Mot de passe</label>
          <div className="admin-password-field">
            <input
              id="admin-password"
              type={showPassword ? 'text' : 'password'}
              name="password"
              autoComplete="current-password"
              minLength={8}
              required
            />
            <button
              type="button"
              aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              aria-pressed={showPassword}
              onClick={() => setShowPassword(!showPassword)}
            >
              <AdminIcon name={showPassword ? 'eye-off' : 'eye'} />
            </button>
          </div>
          {error ? (
            <p className="admin-image-error" role="alert">
              {error}
            </p>
          ) : null}
          <button className="admin-primary-button" type="submit" disabled={loading}>
            {loading ? 'Connexion…' : 'Accéder au tableau de bord'} <AdminIcon name="arrow" />
          </button>
          <p className="admin-demo-note">
            Accès réservé à votre équipe. En cas de difficulté, contactez le propriétaire de la
            boutique.
          </p>
          <Link href="/">← Retour à la boutique</Link>
        </form>
      </section>
    </main>
  );
}
