export const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ?? 'http://localhost:4000/api/v1';

export interface ApiCategory {
  id: string;
  name: string;
  slug: string;
}
export interface ApiProduct {
  promotionStartsAt?: string | null;
  promotionEndsAt?: string | null;
  images?: Array<{ id: string; alt: string }>;
  specifications?: Array<{ label: string; value: string }>;
  warranty?: string;
  variants?: ApiProduct['variant'][];
  id: string;
  name: string;
  slug: string;
  description: string;
  status: 'draft' | 'published';
  category: { id: string; name: string; slug: string };
  variant: {
    id: string;
    sku: string;
    name: string;
    priceMillimes: number;
    compareAtPriceMillimes?: number | null;
    stockQuantity: number;
    lowStockThreshold: number;
  };
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
  }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const base =
    typeof window === 'undefined' ? (process.env.API_INTERNAL_BASE_URL ?? apiBaseUrl) : apiBaseUrl;
  const response = await fetch(`${base}${path}`, {
    cache: 'no-store',
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers }
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    const message = Array.isArray(body?.message) ? body.message.join(', ') : body?.message;
    throw new ApiError(message || `La requête a échoué (${response.status}).`, response.status);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function formatMillimes(value: number): string {
  return new Intl.NumberFormat('fr-TN', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3
  }).format(value / 1000);
}

export function toSlug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
