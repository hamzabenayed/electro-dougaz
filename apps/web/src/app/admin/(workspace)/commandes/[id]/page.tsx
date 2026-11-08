import { AdminOrderDetail } from '../../../../../components/admin-orders';
export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminOrderDetail id={id} />;
}
