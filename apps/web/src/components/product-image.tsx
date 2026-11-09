'use client';
import { apiBaseUrl } from '../lib/api';
export function ProductImage({
  slug,
  name,
  imageId,
  eager = false
}: Readonly<{ slug: string; name: string; imageId?: string; eager?: boolean }>) {
  return (
    <img
      src={
        imageId
          ? `${apiBaseUrl}/media/${encodeURIComponent(imageId)}`
          : `/local-images/${encodeURIComponent(slug)}`
      }
      alt={name}
      onError={(event) => {
        const fallback = `/local-images/${encodeURIComponent(slug)}`;
        if (event.currentTarget.getAttribute('src') !== fallback)
          event.currentTarget.src = fallback;
      }}
      loading={eager ? 'eager' : 'lazy'}
      width={320}
      height={240}
      style={{ width: '100%', height: '100%', maxHeight: 420, objectFit: 'contain' }}
    />
  );
}
