'use client';
import { useEffect, useRef, useState } from 'react';
import { apiBaseUrl } from '../lib/api';
export function ProductGallery({
  slug,
  name,
  images = []
}: {
  slug: string;
  name: string;
  images?: Array<{ id: string; alt: string }>;
}) {
  const [selected, setSelected] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const previousOverflow = useRef<string | null>(null);
  function restoreScroll() {
    if (previousOverflow.current !== null) {
      document.body.style.overflow = previousOverflow.current;
      previousOverflow.current = null;
    }
  }
  useEffect(
    () => () => {
      if (previousOverflow.current !== null)
        document.body.style.overflow = previousOverflow.current;
    },
    []
  );
  const photos = images.length
    ? images.map((image) => ({
        src: `${apiBaseUrl}/media/${encodeURIComponent(image.id)}`,
        alt: image.alt || name
      }))
    : [{ src: `/local-images/${encodeURIComponent(slug)}`, alt: name }];
  const photo = photos[selected] ?? photos[0]!;
  return (
    <div className="product-gallery">
      <button
        type="button"
        className="gallery-main"
        aria-label="Agrandir la photo du produit"
        onClick={() => {
          previousOverflow.current = document.body.style.overflow;
          dialog.current?.showModal();
          document.body.style.overflow = 'hidden';
        }}
      >
        <img src={photo.src} alt={photo.alt} width={800} height={800} />
        <span>⊕ Agrandir</span>
      </button>
      {photos.length > 1 && (
        <div className="gallery-thumbnails" aria-label="Photos du produit">
          {photos.map((item, index) => (
            <button
              key={item.src}
              type="button"
              aria-label={`Photo ${index + 1}`}
              aria-pressed={index === selected}
              onClick={() => setSelected(index)}
            >
              <img src={item.src} alt="" loading="lazy" width={80} height={80} />
            </button>
          ))}
        </div>
      )}
      <dialog
        ref={dialog}
        className="gallery-dialog"
        aria-label="Photo agrandie"
        onClose={restoreScroll}
        onClick={(event) => {
          if (event.target === event.currentTarget) dialog.current?.close();
        }}
      >
        <button
          type="button"
          className="secondary-button"
          autoFocus
          onClick={() => dialog.current?.close()}
        >
          Fermer ×
        </button>
        <img src={photo.src} alt={photo.alt} width={1200} height={1200} />
      </dialog>
    </div>
  );
}
