import Link from 'next/link';
import { AdminProductEditor } from '../../../../../components/admin-product-editor';
import { AdminPageHeader } from '../../../../../components/admin-ui';
export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <div className="admin-back-link">
        <Link href="/admin/produits">← Retour aux produits</Link>
      </div>
      <AdminPageHeader
        eyebrow="Catalogue"
        title="Modifier le produit"
        description="Mettez à jour les informations visibles dans la boutique."
      />
      <AdminProductEditor id={id} />
    </>
  );
}
