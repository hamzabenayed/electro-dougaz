'use client';
import { useEffect, useState } from 'react';
import { apiRequest, type ApiProduct } from '../lib/api';
import { getAdminToken } from '../lib/admin-session';
import { AdminProductForm } from './admin-product-form';

export function AdminProductEditor({ id }: Readonly<{ id: string }>) {
  const [product, setProduct] = useState<ApiProduct>();
  const [error, setError] = useState('');
  useEffect(() => {
    apiRequest<ApiProduct>(`/admin/products/${id}`, {
      headers: { Authorization: `Bearer ${getAdminToken() ?? ''}` }
    })
      .then(setProduct)
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : 'Chargement impossible.')
      );
  }, [id]);
  if (error) return <p role="alert">{error}</p>;
  return product ? (
    <AdminProductForm key={product.id} mode="edit" product={product} />
  ) : (
    <p role="status">Chargement…</p>
  );
}
