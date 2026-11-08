export interface PublicSettings {
  phone: string;
  whatsapp: string;
  contactEmail: string;
  address: string;
  openingHours: string;
  deliveryMillimes: number;
  deliveryEstimate: string;
}
export interface StoreSettings extends PublicSettings {
  notificationEmail: string;
  revision: number;
  updatedAt?: string;
}
