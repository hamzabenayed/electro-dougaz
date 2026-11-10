// Synthetic read-only catalogue for browser tests. Never connects to the shop database.
const { createServer } = require('node:http');
const category = { id: 'category', name: 'Smartphones', slug: 'smartphones' };
const variants = [
  {
    id: 'variant-black',
    name: 'Noir · 128 Go',
    sku: 'BLACK-128',
    priceMillimes: 800000,
    compareAtPriceMillimes: 1000000,
    stockQuantity: 5,
    lowStockThreshold: 3
  },
  {
    id: 'variant-blue',
    name: 'Bleu · 256 Go',
    sku: 'BLUE-256',
    priceMillimes: 1200000,
    stockQuantity: 3,
    lowStockThreshold: 3
  },
  {
    id: 'variant-sold',
    name: 'Rouge · 256 Go',
    sku: 'RED-256',
    priceMillimes: 1100000,
    stockQuantity: 0,
    lowStockThreshold: 3
  }
];
const product = {
  id: 'fixture-product',
  name: 'Smartphone Démo',
  slug: 'smartphone-demo',
  description: 'Un téléphone de démonstration pour tester toutes les options.',
  status: 'published',
  category,
  variant: variants[0],
  variants,
  images: [
    { id: 'image-one', alt: 'Téléphone face' },
    { id: 'image-two', alt: 'Téléphone dos' }
  ],
  warranty: 'Garantie de démonstration : 1 an.',
  specifications: [
    { label: 'Écran', value: '6,5 pouces' },
    { label: 'Réseau', value: '5G' }
  ]
};
const settings = {
  phone: '',
  whatsapp: '',
  contactEmail: '',
  address: '',
  openingHours: '',
  deliveryMillimes: 8000,
  deliveryEstimate: '2 à 4 jours ouvrables'
};
createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1:4101');
  let data;
  if (url.pathname === '/api/v1/categories') data = [category];
  else if (url.pathname === '/api/v1/products/smartphone-demo') data = product;
  else if (url.pathname === '/api/v1/products') {
    const q = url.searchParams.get('q')?.toLowerCase();
    const eligible = variants.filter(
      (v) =>
        (!url.searchParams.has('available') || v.stockQuantity > 0) &&
        (!url.searchParams.has('promotion') || v.compareAtPriceMillimes > v.priceMillimes) &&
        (!url.searchParams.has('minPrice') ||
          v.priceMillimes >= Number(url.searchParams.get('minPrice'))) &&
        (!url.searchParams.has('maxPrice') ||
          v.priceMillimes <= Number(url.searchParams.get('maxPrice')))
    );
    data =
      (!q || product.name.toLowerCase().includes(q)) && eligible.length
        ? [{ ...product, variant: eligible[0] }]
        : [];
  } else if (['/api/v1/settings', '/api/v1/orders/options'].includes(url.pathname)) data = settings;
  else {
    res.statusCode = 404;
    data = { message: 'Not found' };
  }
  if (url.pathname === '/api/v1/products' && url.searchParams.get('q') === 'card-showcase') {
    data = variants.map((variant, index) => ({
      ...product,
      id: `card-${index}`,
      name:
        index === 0
          ? 'Smartphone Démo avec écran haute définition et une très longue description du modèle'
          : `Smartphone Démo ${index + 1}`,
      variant,
      variants: [variant]
    }));
  }
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}).listen(4101, '127.0.0.1');
