import { notFound } from 'next/navigation';
import { CatalogBrowser, type CatalogParams } from '../../../components/catalog-browser';
import { apiRequest, type ApiCategory } from '../../../lib/api';
export const dynamic = 'force-dynamic';
export default async function CategoryPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<CatalogParams>;
}) {
  const { slug } = await params;
  const categories = await apiRequest<ApiCategory[]>('/categories');
  if (!categories.some((c) => c.slug === slug)) notFound();
  return CatalogBrowser({ params: (await searchParams) ?? {}, category: slug });
}
