'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { AdminLoading, AdminPageHeader, StatusBadge } from '../../../../components/admin-ui';
import { AdminIcon } from '../../../../components/admin-icon';
import { apiRequest, formatMillimes } from '../../../../lib/api';
import { adminRequest } from '../../../../lib/admin-api';
import type { PublicSettings, StoreSettings } from '../../../../lib/settings';

type Draft = Omit<StoreSettings, 'deliveryMillimes' | 'updatedAt'> & { deliveryFee: string };
const toDraft = (value: StoreSettings): Draft => ({
  phone: value.phone,
  whatsapp: value.whatsapp,
  contactEmail: value.contactEmail,
  address: value.address,
  openingHours: value.openingHours,
  deliveryEstimate: value.deliveryEstimate,
  notificationEmail: value.notificationEmail,
  revision: value.revision,
  deliveryFee: (value.deliveryMillimes / 1000).toFixed(3)
});

export default function SettingsPage() {
  const [saved, setSaved] = useState<StoreSettings>();
  const [draft, setDraft] = useState<Draft>();
  const [owner, setOwner] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [reload, setReload] = useState(0);
  const dirty = !!saved && !!draft && JSON.stringify(toDraft(saved)) !== JSON.stringify(draft);
  useEffect(() => {
    let active = true;
    async function load() {
      setError('');
      try {
        const user = await adminRequest<{ role: string }>('/admin/auth/me');
        const isOwner = user.role === 'owner';
        const value: StoreSettings = isOwner
          ? await adminRequest<StoreSettings>('/admin/settings')
          : {
              ...(await apiRequest<PublicSettings>('/settings')),
              notificationEmail: '',
              revision: 0
            };
        if (active) {
          setOwner(isOwner);
          setSaved(value);
          setDraft(toDraft(value));
        }
      } catch {
        if (active)
          setError(
            'Impossible de charger les paramètres. Vérifiez votre connexion et votre session.'
          );
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [reload]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  function change(key: keyof Draft, value: string) {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
    setSuccess(false);
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft || !owner || busy || !dirty) return;
    setBusy(true);
    setError('');
    setSuccess(false);
    try {
      const { deliveryFee, ...rest } = draft;
      const value = await adminRequest<StoreSettings>('/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({ ...rest, deliveryMillimes: Math.round(Number(deliveryFee) * 1000) })
      });
      setSaved(value);
      setDraft(toDraft(value));
      setSuccess(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Enregistrement impossible.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <AdminPageHeader
        eyebrow="Votre boutique, vos règles"
        title="Paramètres de la boutique"
        description="Des coordonnées à jour, une livraison claire et une équipe bien informée."
      />
      {error && (
        <div role="alert">
          {error}
          {!draft && (
            <button
              className="admin-secondary-button"
              onClick={() => setReload((value) => value + 1)}
            >
              Réessayer
            </button>
          )}
        </div>
      )}
      {!draft ? (
        !error && <AdminLoading />
      ) : (
        <>
          <section className="admin-settings-banner">
            <span className="admin-section-icon">
              <AdminIcon name="settings" size={28} />
            </span>
            <div>
              <h2>Les détails qui font la différence.</h2>
              <p>
                Les informations publiques sont visibles sur la boutique. Les accès techniques
                restent protégés.
              </p>
            </div>
            <StatusBadge tone={owner ? 'info' : 'neutral'}>
              {owner ? 'Accès propriétaire' : 'Lecture seule'}
            </StatusBadge>
          </section>
          {!owner && (
            <p className="admin-settings-note">
              <AdminIcon name="shield" /> Seul le propriétaire peut modifier ces paramètres.
            </p>
          )}
          <nav className="admin-settings-nav" aria-label="Sections des paramètres">
            <a href="#settings-shop">
              <AdminIcon name="store" /> Boutique
            </a>
            <a href="#settings-delivery">
              <AdminIcon name="truck" /> Livraison
            </a>
            {owner && (
              <a href="#settings-notifications">
                <AdminIcon name="bell" /> Notifications
              </a>
            )}
          </nav>
          <form onSubmit={(event) => void submit(event)} className="admin-settings-layout">
            <fieldset disabled={!owner || busy} className="admin-settings-fields">
              <section id="settings-shop" className="admin-panel admin-form-section">
                <header>
                  <div>
                    <h2>
                      <AdminIcon name="store" /> Coordonnées de la boutique
                    </h2>
                    <p>
                      Affichées sur la page Contact. Laissez vide ce que vous ne souhaitez pas
                      publier.
                    </p>
                  </div>
                  <span className="admin-settings-step">01</span>
                </header>
                <div className="admin-form-grid">
                  <label>
                    Téléphone
                    <input
                      type="tel"
                      value={draft.phone}
                      onChange={(e) => change('phone', e.target.value)}
                      maxLength={30}
                      placeholder="+216 00 000 000"
                    />
                  </label>
                  <label>
                    WhatsApp
                    <input
                      type="tel"
                      value={draft.whatsapp}
                      onChange={(e) => change('whatsapp', e.target.value)}
                      maxLength={15}
                      pattern="[1-9][0-9]{7,14}"
                      placeholder="216XXXXXXXX"
                    />
                    <small>Indicatif pays inclus, sans + ni espaces.</small>
                  </label>
                  <label className="full-field">
                    E-mail de contact
                    <input
                      type="email"
                      value={draft.contactEmail}
                      onChange={(e) => change('contactEmail', e.target.value)}
                      maxLength={254}
                      placeholder="contact@votre-boutique.tn"
                    />
                  </label>
                  <label className="full-field">
                    Adresse du magasin
                    <textarea
                      rows={3}
                      value={draft.address}
                      onChange={(e) => change('address', e.target.value)}
                      maxLength={300}
                      placeholder="Rue, ville et code postal"
                    />
                  </label>
                  <label className="full-field">
                    Horaires d’ouverture
                    <input
                      value={draft.openingHours}
                      onChange={(e) => change('openingHours', e.target.value)}
                      maxLength={200}
                      placeholder="Ex. : Lun–Sam, 09:00–18:00"
                    />
                  </label>
                </div>
              </section>
              <section id="settings-delivery" className="admin-panel admin-form-section">
                <header>
                  <div>
                    <h2>
                      <AdminIcon name="truck" /> Livraison
                    </h2>
                    <p>Un tarif simple et transparent pour vos clients.</p>
                  </div>
                  <span className="admin-settings-step">02</span>
                </header>
                <div className="admin-form-grid">
                  <label>
                    Frais de livraison (DT)
                    <input
                      required
                      type="number"
                      min="0"
                      max="1000"
                      step="0.001"
                      value={draft.deliveryFee}
                      onChange={(e) => change('deliveryFee', e.target.value)}
                    />
                    <small>0 DT = livraison gratuite. Jusqu’à 3 décimales.</small>
                  </label>
                  <label>
                    Délai estimé
                    <input
                      value={draft.deliveryEstimate}
                      onChange={(e) => change('deliveryEstimate', e.target.value)}
                      maxLength={120}
                      placeholder="Ex. : 2 à 4 jours ouvrables"
                    />
                  </label>
                </div>
                <p className="admin-settings-note">
                  <AdminIcon name="shield" /> Les commandes existantes conservent leurs frais
                  d’origine.
                </p>
              </section>
              {owner && (
                <section id="settings-notifications" className="admin-panel admin-form-section">
                  <header>
                    <div>
                      <h2>
                        <AdminIcon name="bell" /> Notifications de commandes
                      </h2>
                      <p>Une adresse interne, jamais publiée sur la boutique.</p>
                    </div>
                    <span className="admin-settings-step">03</span>
                  </header>
                  <label>
                    E-mail de notification
                    <input
                      type="email"
                      value={draft.notificationEmail}
                      onChange={(e) => change('notificationEmail', e.target.value)}
                      maxLength={254}
                      placeholder="commandes@votre-boutique.tn"
                    />
                  </label>
                  <p className="admin-settings-note">
                    <AdminIcon name="mail" /> Adresse enregistrée pour la future connexion du
                    service e-mail. Aucun envoi automatique n’est actif pour le moment.
                  </p>
                </section>
              )}
            </fieldset>
            <aside className="admin-settings-preview">
              <section className="admin-panel">
                <header>
                  <div>
                    <h2>
                      <AdminIcon name="eye" /> Aperçu client
                    </h2>
                    <p>
                      {dirty
                        ? 'Aperçu de vos modifications non enregistrées.'
                        : 'Vos informations publiques.'}
                    </p>
                  </div>
                </header>
                <h3>Electro Dougaz</h3>
                <dl>
                  <dt>Téléphone</dt>
                  <dd>{draft.phone || 'Non renseigné'}</dd>
                  <dt>WhatsApp</dt>
                  <dd>{draft.whatsapp || 'Non renseigné'}</dd>
                  <dt>Contact</dt>
                  <dd>{draft.contactEmail || 'Non renseigné'}</dd>
                  <dt>Adresse</dt>
                  <dd>{draft.address || 'Non renseignée'}</dd>
                  <dt>Horaires</dt>
                  <dd>{draft.openingHours || 'Non renseignés'}</dd>
                </dl>
                <div className="admin-settings-price">
                  <AdminIcon name="truck" />
                  <div>
                    <strong>{formatMillimes(Number(draft.deliveryFee || 0) * 1000)} DT</strong>
                    <span>{draft.deliveryEstimate || 'Délai à préciser'}</span>
                  </div>
                </div>
              </section>
              <section className="admin-panel">
                <h2>
                  <AdminIcon name="shield" /> Paiement protégé
                </h2>
                <p>Paiement à la livraison actif.</p>
                <StatusBadge>ClicToPay non connecté</StatusBadge>
                <p>Les clés bancaires et mots de passe ne sont jamais modifiables ici.</p>
              </section>
            </aside>
            {owner && (
              <div className="admin-settings-actions">
                <div aria-live="polite">
                  <strong>
                    {busy
                      ? 'Enregistrement…'
                      : dirty
                        ? 'Modifications non enregistrées'
                        : success
                          ? 'Paramètres enregistrés'
                          : 'Tout est à jour'}
                  </strong>
                  <small>
                    {success
                      ? 'Les informations sont maintenant disponibles sur la boutique.'
                      : 'Vérifiez l’aperçu avant de publier vos changements.'}
                  </small>
                </div>
                <button
                  type="button"
                  className="admin-secondary-button"
                  disabled={!dirty || busy}
                  onClick={() => {
                    if (saved) setDraft(toDraft(saved));
                    setError('');
                    setSuccess(false);
                  }}
                >
                  Annuler
                </button>
                <button type="submit" className="admin-primary-button" disabled={!dirty || busy}>
                  <AdminIcon name="check" />
                  {busy ? 'Enregistrement…' : 'Enregistrer les modifications'}
                </button>
              </div>
            )}
          </form>
        </>
      )}
    </>
  );
}
