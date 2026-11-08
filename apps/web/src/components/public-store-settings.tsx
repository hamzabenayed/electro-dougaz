'use client';
import { useEffect, useState } from 'react';
import { apiRequest, formatMillimes } from '../lib/api';
import type { PublicSettings } from '../lib/settings';

export function PublicStoreSettings({ delivery = false }: { delivery?: boolean }) {
  const [settings, setSettings] = useState<PublicSettings>();
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    apiRequest<PublicSettings>('/settings')
      .then((value) => {
        if (active) setSettings(value);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, []);
  if (error)
    return (
      <p role="status">Informations momentanément indisponibles. Veuillez réessayer plus tard.</p>
    );
  if (!settings) return <p role="status">Chargement des informations…</p>;
  if (delivery)
    return (
      <>
        <p>
          Frais de livraison : <strong>{formatMillimes(settings.deliveryMillimes)} DT</strong>.
        </p>
        {settings.deliveryEstimate && <p>Délai estimé : {settings.deliveryEstimate}.</p>}
        <p>Le montant final est indiqué lors de la confirmation de votre commande.</p>
      </>
    );
  return (
    <div className="contact-options public-store-details">
      {settings.phone && (
        <a className="secondary-button" href={`tel:${settings.phone.replace(/[^+0-9]/g, '')}`}>
          {settings.phone}
        </a>
      )}
      {settings.whatsapp && /^[1-9][0-9]{7,14}$/.test(settings.whatsapp) && (
        <a
          className="secondary-button"
          href={`https://wa.me/${settings.whatsapp}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          WhatsApp
        </a>
      )}
      {settings.contactEmail && (
        <a className="secondary-button" href={`mailto:${settings.contactEmail}`}>
          {settings.contactEmail}
        </a>
      )}
      {settings.address && <p style={{ whiteSpace: 'pre-line' }}>Adresse : {settings.address}</p>}
      {settings.openingHours && <p>Horaires : {settings.openingHours}</p>}
      {!settings.phone &&
        !settings.contactEmail &&
        !settings.address &&
        !settings.whatsapp &&
        !settings.openingHours && <p>Les coordonnées du magasin seront bientôt disponibles.</p>}
    </div>
  );
}
