import { CatalogBrowser, type CatalogParams } from '../../components/catalog-browser';
export const dynamic = 'force-dynamic';
export default async function SearchPage({
  searchParams
}: {
  searchParams: Promise<CatalogParams>;
}) {
  return CatalogBrowser({ params: await searchParams });
}
