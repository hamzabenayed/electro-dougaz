import Link from 'next/link';
import { AdminProductForm } from '../../../../../components/admin-product-form';
import { AdminPageHeader } from '../../../../../components/admin-ui';
export default function NewProductPage() {
  return (
    <>
      <div className="admin-back-link">
        <Link href="/admin/produits">← Retour aux produits</Link>
      </div>
      <AdminPageHeader
        eyebrow="Catalogue"
        title="Nouveau produit"
        description="Complétez les informations essentielles. Vous pourrez enregistrer en brouillon."
      />
      <AdminProductForm />
    </>
  );
}
