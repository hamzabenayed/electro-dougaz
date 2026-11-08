export type OrderStatus = 'À confirmer' | 'À préparer' | 'Expédiée' | 'Livrée';

export interface AdminOrder {
  id: string;
  customer: string;
  phone: string;
  city: string;
  date: string;
  total: number;
  payment: 'À la livraison' | 'Carte';
  paymentStatus: 'À encaisser' | 'Payé';
  status: OrderStatus;
  items: number;
}

export const adminOrders: AdminOrder[] = [
  {
    id: 'ED-1048',
    customer: 'Amira Ben Salah',
    phone: '22 000 148',
    city: 'Tunis',
    date: 'Aujourd’hui, 10:42',
    total: 1548,
    payment: 'À la livraison',
    paymentStatus: 'À encaisser',
    status: 'À confirmer',
    items: 2
  },
  {
    id: 'ED-1047',
    customer: 'Mohamed Trabelsi',
    phone: '55 000 247',
    city: 'Sfax',
    date: 'Aujourd’hui, 09:18',
    total: 2649,
    payment: 'Carte',
    paymentStatus: 'Payé',
    status: 'À préparer',
    items: 1
  },
  {
    id: 'ED-1046',
    customer: 'Sarra Gharbi',
    phone: '98 000 346',
    city: 'Sousse',
    date: 'Hier, 16:05',
    total: 249,
    payment: 'À la livraison',
    paymentStatus: 'À encaisser',
    status: 'Expédiée',
    items: 1
  },
  {
    id: 'ED-1045',
    customer: 'Yassine Ayari',
    phone: '27 000 445',
    city: 'Nabeul',
    date: 'Hier, 13:31',
    total: 1849,
    payment: 'Carte',
    paymentStatus: 'Payé',
    status: 'Livrée',
    items: 1
  }
];

export const adminProducts = [
  {
    id: 'nova-x12-256',
    name: 'Smartphone Nova X12 5G — 256 Go',
    category: 'Smartphones',
    price: 1299,
    stock: 12,
    status: 'Publié'
  },
  {
    id: 'probook-15-i7',
    name: 'PC Portable ProBook 15 — Core i7',
    category: 'Informatique',
    price: 2649,
    stock: 3,
    status: 'Publié'
  },
  {
    id: 'crystal-uhd-55',
    name: 'Smart TV Crystal UHD 55 pouces',
    category: 'TV & image',
    price: 1849,
    stock: 8,
    status: 'Publié'
  },
  {
    id: 'pulse-anc',
    name: 'Casque sans fil Pulse ANC',
    category: 'Audio',
    price: 249,
    stock: 19,
    status: 'Brouillon'
  }
];

export const formatAdminPrice = (value: number) => `${value.toFixed(3).replace('.', ',')} DT`;
