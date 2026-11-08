export interface ApiOrder {
  history?: Array<{ status: string; at: string }>;
  id: string;
  reference: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  customer: {
    firstName: string;
    lastName: string;
    phone: string;
    address: string;
    governorate: string;
  };
  subtotalMillimes: number;
  deliveryMillimes: number;
  totalMillimes: number;
  createdAt: string;
  items?: Array<{
    id: string;
    productName: string;
    quantity: number;
    unitPriceMillimes: number;
    lineTotalMillimes: number;
  }>;
}
export const orderLabels: Record<string, string> = {
  pending: 'À confirmer',
  confirmed: 'Confirmée',
  preparing: 'En préparation',
  shipped: 'Expédiée',
  delivered: 'Livrée',
  delivery_failed: 'Livraison échouée',
  returned: 'Retournée',
  cancelled: 'Annulée',
  awaiting_payment: 'En attente de paiement',
  payment_failed: 'Paiement échoué'
};
export const orderTransitions: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['shipped', 'cancelled'],
  shipped: ['delivered', 'delivery_failed'],
  delivery_failed: ['shipped', 'returned'],
  delivered: ['returned'],
  returned: [],
  cancelled: []
};
