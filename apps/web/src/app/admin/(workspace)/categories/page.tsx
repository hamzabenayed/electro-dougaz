'use client';
import { useEffect, useState } from 'react';
import { AdminIcon } from '../../../../components/admin-icon';
import { AdminPageHeader, StatusBadge } from '../../../../components/admin-ui';
import { adminRequest } from '../../../../lib/admin-api';
import { toSlug, type ApiCategory } from '../../../../lib/api';
export default function CategoriesPage() {
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    adminRequest<ApiCategory[]>('/admin/categories')
      .then(setCategories)
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : 'Chargement impossible')
      )
      .finally(() => setLoading(false));
  }, []);
  async function change(category: ApiCategory, remove = false) {
    if (busy) return;
    const visible = category.isVisible !== false;
    const confirmation = remove
      ? `Supprimer définitivement la catégorie « ${category.name} » ? Seules les catégories vides peuvent être supprimées.`
      : `${visible ? 'Masquer' : 'Afficher'} « ${category.name} » et ses produits dans la boutique ? Les produits restent dans le tableau de bord.`;
    if (!window.confirm(confirmation)) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await adminRequest(
        `/admin/categories/${category.id}`,
        remove
          ? { method: 'DELETE' }
          : { method: 'PATCH', body: JSON.stringify({ isVisible: !visible }) }
      );
      setCategories(await adminRequest<ApiCategory[]>('/admin/categories'));
      setMessage(
        remove
          ? 'Catégorie supprimée.'
          : visible
            ? 'Catégorie masquée dans la boutique.'
            : 'Catégorie visible dans la boutique.'
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Modification impossible');
    } finally {
      setBusy(false);
    }
  }
  async function create(form: HTMLFormElement) {
    const nameValue = new FormData(form).get('name');
    if (typeof nameValue !== 'string') return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await adminRequest('/admin/categories', {
        method: 'POST',
        body: JSON.stringify({ name: nameValue.trim(), slug: toSlug(nameValue), isVisible: true })
      });
      setCategories(await adminRequest<ApiCategory[]>('/admin/categories'));
      form.reset();
      setMessage('Catégorie ajoutée.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Création impossible');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <AdminPageHeader
        eyebrow="Catalogue"
        title="Catégories"
        description="Masquez une catégorie sans perdre ses produits. Supprimez uniquement les catégories vides."
      />
      {error ? <p role="alert">{error}</p> : null}
      {message ? <p role="status">{message}</p> : null}
      {loading && <p role="status">Chargement des catégories…</p>}
      {!loading && !error && !categories.length && (
        <p>Aucune catégorie. Créez la première ci-dessous.</p>
      )}
      <section className="admin-category-grid">
        {categories.map((category) => (
          <article
            className="admin-panel admin-category-card category-management"
            key={category.id}
          >
            <span className="admin-category-icon">
              <AdminIcon name="categories" />
            </span>
            <div>
              <h2>{category.name}</h2>
              <p>{category.slug}</p>
              <StatusBadge tone={category.isVisible === false ? 'neutral' : 'success'}>
                {category.isVisible === false ? 'Masquée' : 'Visible'}
              </StatusBadge>
              <p>{category.productCount ?? 0} produit(s)</p>
            </div>
            <div className="category-actions">
              <button
                className="admin-secondary-button"
                disabled={busy}
                onClick={() => void change(category)}
              >
                <AdminIcon name={category.isVisible === false ? 'eye' : 'eye-off'} />
                {category.isVisible === false ? 'Afficher' : 'Masquer'}
                <span className="sr-only"> {category.name}</span>
              </button>
              <button
                className="admin-danger-button"
                disabled={busy || (category.productCount ?? 0) > 0}
                onClick={() => void change(category, true)}
              >
                Supprimer<span className="sr-only"> {category.name}</span>
              </button>
              {(category.productCount ?? 0) > 0 && (
                <small>Déplacez les produits avant de supprimer.</small>
              )}
            </div>
          </article>
        ))}
      </section>
      <form
        className="admin-panel admin-form-section"
        onSubmit={(event) => {
          event.preventDefault();
          void create(event.currentTarget);
        }}
      >
        <header>
          <div>
            <h2>Nouvelle catégorie</h2>
            <p>Un nom simple pour guider vos clients.</p>
          </div>
          <span className="admin-section-icon">
            <AdminIcon name="plus" />
          </span>
        </header>
        <label>
          Nom
          <input name="name" minLength={2} maxLength={100} required />
        </label>
        <button className="admin-primary-button" disabled={busy}>
          Ajouter
        </button>
      </form>
    </>
  );
}
