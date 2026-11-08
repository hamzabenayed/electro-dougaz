import { z } from 'zod';

export const OrderStatusSchema = z.enum([
  'pending',
  'awaiting_payment',
  'payment_failed',
  'confirmed',
  'preparing',
  'shipped',
  'delivered',
  'delivery_failed',
  'returned',
  'refund_requested',
  'refunded',
  'cancelled'
]);

export const PaymentMethodSchema = z.enum(['cash_on_delivery', 'online_card']);

export type OrderStatus = z.infer<typeof OrderStatusSchema>;
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;

export const AdminRoleSchema = z.enum(['owner', 'manager', 'fulfillment']);
export const ProductStatusSchema = z.enum(['draft', 'published', 'archived']);
export const PaymentStatusSchema = z.enum(['pending', 'paid', 'failed', 'refunded']);
export type AdminRole = z.infer<typeof AdminRoleSchema>;
export type ProductStatus = z.infer<typeof ProductStatusSchema>;
export type PaymentStatus = z.infer<typeof PaymentStatusSchema>;
