export interface CatalogProduct {
  imageId?: string;
  images?: Array<{ id: string; alt: string }>;
  variants?: ProductApiRecord['variant'][];
  warranty?: string;
  variantId?: string;
  id: string;
  slug: string;
  name: string;
  category: string;
  categorySlug: string;
  price: number;
  oldPrice?: number;
  rating: number;
  reviews: number;
  stock: number;
  summary: string;
  specifications: Array<{ label: string; value: string }>;
}

export interface ProductApiRecord {
  images?: Array<{ id: string; alt: string }>;
  specifications?: Array<{ label: string; value: string }>;
  warranty?: string;
  variants?: ProductApiRecord['variant'][];
  id: string;
  slug: string;
  name: string;
  description: string;
  category: { name: string; slug: string };
  variant: {
    name?: string;
    id: string;
    sku: string;
    priceMillimes: number;
    compareAtPriceMillimes?: number | null;
    stockQuantity: number;
  };
}

export function fromApiProduct(product: ProductApiRecord): CatalogProduct {
  return {
    images: product.images,
    imageId: product.images?.[0]?.id,
    variants: product.variants,
    warranty: product.warranty,
    id: product.variant.id,
    variantId: product.variant.id,
    slug: product.slug,
    name: product.name,
    category: product.category.name,
    categorySlug: product.category.slug,
    price: product.variant.priceMillimes / 1000,
    ...(product.variant.compareAtPriceMillimes
      ? { oldPrice: product.variant.compareAtPriceMillimes / 1000 }
      : {}),
    rating: 0,
    reviews: 0,
    stock: product.variant.stockQuantity,
    summary: product.description,
    specifications: [
      { label: 'Référence', value: product.variant.sku },
      ...(product.specifications ?? [])
    ]
  };
}

export const catalogProducts: CatalogProduct[] = [
  {
    id: 'nova-x12-256',
    slug: 'smartphone-nova-x12-5g-256-go',
    name: 'Smartphone Nova X12 5G — 256 Go',
    category: 'Smartphones',
    categorySlug: 'smartphones',
    price: 1299,
    oldPrice: 1449,
    rating: 4.8,
    reviews: 42,
    stock: 12,
    summary:
      'Un smartphone 5G fluide avec un écran lumineux, une grande autonomie et 256 Go de stockage.',
    specifications: [
      { label: 'Stockage', value: '256 Go' },
      { label: 'Réseau', value: '5G' },
      { label: 'Garantie', value: '1 an' }
    ]
  },
  {
    id: 'probook-15-i7',
    slug: 'pc-portable-probook-15-core-i7',
    name: 'PC Portable ProBook 15 — Core i7',
    category: 'Informatique',
    categorySlug: 'informatique',
    price: 2649,
    oldPrice: 2899,
    rating: 4.9,
    reviews: 27,
    stock: 3,
    summary:
      'Un ordinateur portable performant pour le travail, les études et la création quotidienne.',
    specifications: [
      { label: 'Processeur', value: 'Intel Core i7' },
      { label: 'Écran', value: '15,6 pouces' },
      { label: 'Garantie', value: '2 ans' }
    ]
  },
  {
    id: 'crystal-uhd-55',
    slug: 'smart-tv-crystal-uhd-55',
    name: 'Smart TV Crystal UHD 55 pouces',
    category: 'TV & image',
    categorySlug: 'tv-image',
    price: 1849,
    oldPrice: 2099,
    rating: 4.7,
    reviews: 35,
    stock: 8,
    summary:
      'Une Smart TV 4K grand format avec une image détaillée et vos applications de streaming.',
    specifications: [
      { label: 'Définition', value: '4K UHD' },
      { label: 'Taille', value: '55 pouces' },
      { label: 'Garantie', value: '2 ans' }
    ]
  },
  {
    id: 'pulse-anc',
    slug: 'casque-sans-fil-pulse-anc',
    name: 'Casque sans fil Pulse ANC',
    category: 'Audio',
    categorySlug: 'audio',
    price: 249,
    rating: 4.6,
    reviews: 61,
    stock: 19,
    summary: 'Un casque confortable avec réduction active du bruit et autonomie longue durée.',
    specifications: [
      { label: 'Connexion', value: 'Bluetooth' },
      { label: 'Autonomie', value: '35 heures' },
      { label: 'Garantie', value: '1 an' }
    ]
  }
];

export function findProduct(slug: string): CatalogProduct | undefined {
  return catalogProducts.find((product) => product.slug === slug);
}

export function formatPrice(value: number): string {
  return new Intl.NumberFormat('fr-TN', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3
  }).format(value);
}
