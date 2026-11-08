'use client';
import { useEffect, useState } from 'react';
import { AdminIcon } from '../../../../components/admin-icon';
import { AdminPageHeader } from '../../../../components/admin-ui';
import { adminRequest } from '../../../../lib/admin-api';
import { toSlug, type ApiCategory } from '../../../../lib/api';
export default function CategoriesPage() {
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    adminRequest<ApiCategory[]>('/admin/categories')
      .then(setCategories)
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : 'Chargement impossible')
      );
  }, []);
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
        description="Organisez votre catalogue."
      />
      {error ? <p role="alert">{error}</p> : null}
      {message ? <p role="status">{message}</p> : null}
      <section className="admin-category-grid">
        {categories.map((category) => (
          <article className="admin-panel admin-category-card" key={category.id}>
            <span className="admin-category-icon">
              <AdminIcon name="categories" />
            </span>
            <div>
              <h2>{category.name}</h2>
              <p>{category.slug}</p>
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
