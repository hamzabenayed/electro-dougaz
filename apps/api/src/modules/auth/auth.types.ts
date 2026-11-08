export type AdminRole = 'owner' | 'manager' | 'fulfillment';
export interface AuthenticatedAdmin {
  id: string;
  email: string;
  displayName: string;
  role: AdminRole;
}
