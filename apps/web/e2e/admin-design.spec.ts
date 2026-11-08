import { test, expect, type Page } from '@playwright/test';

const product = {
  id: 'design-product',
  name: 'Smartphone professionnel avec une très longue référence — 256 Go',
  slug: 'design-phone',
  description: 'Un téléphone pour vérifier les formulaires et les petits écrans.',
  status: 'published',
  category: { id: 'category', name: 'Smartphones et accessoires', slug: 'smartphones' },
  variant: {
    id: 'variant',
    sku: 'PHONE-DESIGN-256',
    priceMillimes: 1299000,
    compareAtPriceMillimes: 1599000,
    stockQuantity: 4,
    lowStockThreshold: 5
  }
};
const order = {
  id: 'design-order',
  reference: 'ED-2026-00123456',
  status: 'pending',
  paymentMethod: 'cash_on_delivery',
  paymentStatus: 'pending',
  customer: {
    firstName: 'Amira',
    lastName: 'Ben Salah',
    phone: '22000148',
    governorate: 'Tunis',
    address: '10 avenue de la République, immeuble Les Jasmins'
  },
  totalMillimes: 2606000,
  subtotalMillimes: 2598000,
  deliveryMillimes: 8000,
  createdAt: '2026-10-20T08:00:00Z',
  items: [{ id: 'item', productName: product.name, quantity: 2, lineTotalMillimes: 2598000 }]
};
const settings = {
  phone: '+216 22000148',
  whatsapp: '21622000148',
  contactEmail: 'contact@example.test',
  address: '10 avenue de la République, Tunis',
  openingHours: 'Lun–Sam, 09:00–18:00',
  deliveryMillimes: 8000,
  deliveryEstimate: '2 à 4 jours ouvrables',
  notificationEmail: 'private@example.test',
  revision: 0
};
async function mockApi(page: Page) {
  await page.addInitScript(() =>
    sessionStorage.setItem('electro-dougaz-admin-token', 'design-test-session')
  );
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const endpoint = url.pathname.replace('/api/v1', '');
    if (endpoint.endsWith('/payments') || endpoint.endsWith('/accessories')) {
      await route.fulfill({ json: [] });
      return;
    }
    if (endpoint === '/admin/settings' || endpoint === '/settings') {
      await route.fulfill({ json: settings });
      return;
    }
    const data =
      endpoint === '/admin/auth/me'
        ? { displayName: 'Responsable boutique', email: 'design@example.test', role: 'owner' }
        : endpoint === '/admin/auth/login'
          ? { token: 'design-test-session' }
          : endpoint === '/orders/options'
            ? { deliveryMillimes: 8000 }
            : endpoint.includes('/categories')
              ? [product.category]
              : endpoint === '/admin/products/design-product'
                ? product
                : endpoint === '/admin/products'
                  ? [product]
                  : endpoint === '/admin/orders/design-order'
                    ? order
                    : endpoint === '/admin/orders'
                      ? [
                          order,
                          {
                            ...order,
                            id: 'second',
                            reference: 'ED-2026-00123457',
                            status: 'delivered'
                          }
                        ]
                      : endpoint === '/admin/inventory'
                        ? [
                            {
                              variantId: 'variant',
                              productId: product.id,
                              productName: product.name,
                              sku: product.variant.sku,
                              stockQuantity: 4,
                              lowStockThreshold: 5,
                              isLow: true
                            }
                          ]
                        : {};
    await route.fulfill({ json: data, headers: { 'Access-Control-Allow-Origin': '*' } });
  });
}
const screens = [
  ['connexion', 'Se connecter'],
  ['tableau-de-bord', 'Tableau de bord'],
  ['produits', 'Produits'],
  ['produits/nouveau', 'Nouveau produit'],
  ['produits/design-product', 'Modifier le produit'],
  ['commandes', 'Commandes'],
  ['commandes/design-order', order.reference],
  ['stock', 'Stock'],
  ['categories', 'Catégories'],
  ['parametres', 'Paramètres de la boutique']
];

test('landscape phone keeps final form actions above navigation when scrolled', async ({
  page
}) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await mockApi(page);
  await page.goto('/admin/produits/nouveau');
  const save = page.getByRole('button', { name: 'Créer le produit', exact: true });
  await save.scrollIntoViewIfNeeded();
  await expect(save).toBeInViewport();
  const buttonBox = await save.boundingBox();
  const navBox = await page
    .getByRole('navigation', { name: 'Navigation mobile d’administration' })
    .boundingBox();
  expect(buttonBox).not.toBeNull();
  expect(navBox).not.toBeNull();
  expect(buttonBox!.y + buttonBox!.height).toBeLessThanOrEqual(navBox!.y);
});

test('order actions remain visually distinct and failure stops loading', async ({ page }) => {
  await mockApi(page);
  await page.goto('/admin/commandes/design-order');
  const confirm = page.getByRole('button', { name: 'Confirmée', exact: true });
  const cancel = page.getByRole('button', { name: 'Annulée', exact: true });
  await expect(confirm).toBeVisible();
  const background = (element: Element) => getComputedStyle(element).backgroundColor;
  expect(await confirm.evaluate(background)).not.toBe(await cancel.evaluate(background));
  await page.route('**/api/v1/admin/orders/design-order', (route) =>
    route.fulfill({ status: 404, json: { message: 'Commande introuvable' } })
  );
  await page.reload();
  await expect(page.getByRole('main').getByRole('alert')).toBeVisible();
  await expect(page.getByText('Chargement de la commande…')).toHaveCount(0);
});
for (const width of [360, 768, 1024, 1440]) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`all admin screens at ${width}px in ${colorScheme}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme });
      await mockApi(page);
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      for (const [route, heading] of screens) {
        await page.goto('/admin/' + route);
        await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
        await page.waitForLoadState('networkidle');
        await expect
          .poll(
            () =>
              page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
            { message: `Horizontal overflow on ${route}` }
          )
          .toBe(true);
        const clipped = await page
          .locator('main input:not([type=file]), main select, main textarea, main button')
          .evaluateAll((elements) =>
            elements
              .filter((element) => {
                const box = element.getBoundingClientRect();
                return box.width > 0 && (box.left < -1 || box.right > window.innerWidth + 1);
              })
              .map((element) => element.outerHTML)
          );
        expect(clipped, `Clipped controls on ${route}`).toEqual([]);
        const tiny = await page
          .locator('main button, main select, main input:not([type=file])')
          .evaluateAll((elements) =>
            elements
              .filter((element) => {
                const box = element.getBoundingClientRect();
                return box.width > 0 && box.height < 43;
              })
              .map((element) => element.outerHTML)
          );
        expect(tiny, `Small touch targets on ${route}`).toEqual([]);
        await page.screenshot({
          path: testInfo.outputPath(`${route.replaceAll('/', '-')}.png`),
          fullPage: true,
          animations: 'disabled'
        });
      }
      expect(errors).toEqual([]);
    });
  }
}
test('mobile drawer, keyboard focus, password toggle and reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockApi(page);
  await page.goto('/admin/connexion');
  await page.getByLabel('Mot de passe', { exact: true }).fill('test-password');
  await page.getByRole('button', { name: 'Afficher le mot de passe' }).click();
  await expect(page.getByLabel('Mot de passe', { exact: true })).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Masquer le mot de passe' }).click();
  await expect(page.getByLabel('Mot de passe', { exact: true })).toHaveAttribute(
    'type',
    'password'
  );
  await page.goto('/admin/tableau-de-bord');
  const opener = page.getByRole('button', { name: 'Ouvrir le menu' });
  await opener.click();
  const close = page.getByRole('button', { name: 'Fermer la navigation' });
  await expect(close).toBeFocused();
  await expect(page.getByRole('link', { name: 'Équipe', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Paramètres', exact: true })).toBeVisible();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: 'Se déconnecter' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(opener).toBeFocused();
  await expect(page.locator('.admin-sidebar')).toBeHidden();
  expect(
    await page
      .locator('.admin-route-content')
      .evaluate((element) => getComputedStyle(element).animationName)
  ).toBe('none');
});
