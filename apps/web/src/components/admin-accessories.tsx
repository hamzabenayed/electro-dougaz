'use client';
import { useEffect, useState } from 'react';
import { adminRequest } from '../lib/admin-api';
import type { ApiProduct } from '../lib/api';
export function AdminAccessories({ id }: { id: string }) {
  const [selected, setSelected] = useState<Array<{ id: string; name: string }>>([]),
    [results, setResults] = useState<ApiProduct[]>([]),
    [query, setQuery] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let active = true;
    void adminRequest<Array<{ id: string; name: string }>>(`/admin/products/${id}/accessories`)
      .then((v) => {
        if (active) {
          setSelected(v);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (active) setMessage('Impossible de charger les accessoires. Rechargez la page.');
      });
    return () => {
      active = false;
    };
  }, [id]);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      void adminRequest<ApiProduct[]>(`/admin/products?q=${encodeURIComponent(query)}&limit=20`)
        .then((v) => {
          if (active) setResults(v);
        })
        .catch(() => {
          if (active) setMessage('Recherche indisponible.');
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);
  return (
    <section className="admin-panel report-section">
      <h2>Accessoires compatibles</h2>
      <p>
        Vérifiez vous-même la compatibilité avant de recommander un accessoire. Maximum 8 ; les
        brouillons restent cachés aux clients.
      </p>
      <label>
        Rechercher un accessoire
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      <div className="admin-toolbar">
        {results
          .filter((p) => p.id !== id && !selected.some((s) => s.id === p.id))
          .map((p) => (
            <button
              type="button"
              key={p.id}
              disabled={!loaded || selected.length >= 8 || busy}
              onClick={() => setSelected([...selected, { id: p.id, name: p.name }])}
            >
              + {p.name}
            </button>
          ))}
      </div>
      <ul>
        {selected.map((p) => (
          <li key={p.id}>
            {p.name}{' '}
            <button
              type="button"
              disabled={busy}
              onClick={() => setSelected(selected.filter((s) => s.id !== p.id))}
            >
              Retirer {p.name}
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="admin-primary-button"
        disabled={busy || !loaded}
        onClick={() => {
          void (async () => {
            setBusy(true);
            try {
              await adminRequest(`/admin/products/${id}/accessories`, {
                method: 'PUT',
                body: JSON.stringify({ ids: selected.map((p) => p.id) })
              });
              setMessage('Accessoires enregistrés.');
            } catch (e) {
              setMessage(e instanceof Error ? e.message : 'Enregistrement impossible');
            } finally {
              setBusy(false);
            }
          })();
        }}
      >
        Enregistrer les accessoires
      </button>
      <p role="status">{message}</p>
    </section>
  );
}
