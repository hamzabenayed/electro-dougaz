'use client';
import { useEffect, useState } from 'react';
import { apiBaseUrl } from '../lib/api';
import { getAdminToken } from '../lib/admin-session';
export function AdminSavedImage({ id, alt }: { id: string; alt: string }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let active = true,
      objectUrl = '';
    void fetch(`${apiBaseUrl}/admin/media/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${getAdminToken() ?? ''}` },
      cache: 'no-store'
    })
      .then((response) => {
        if (!response.ok) throw new Error('Image inaccessible');
        return response.blob();
      })
      .then((blob) => {
        if (active) {
          objectUrl = URL.createObjectURL(blob);
          setUrl(objectUrl);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id]);
  return url ? (
    <img className="admin-saved-image" src={url} alt={alt} width={96} height={80} />
  ) : (
    <span className="admin-saved-image" aria-label="Photo enregistrée">
      ▧
    </span>
  );
}
