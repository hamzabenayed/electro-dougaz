import { test, expect } from '@playwright/test';
test.use({ actionTimeout: 15_000 });

const category = {
  id: 'category',
  name: 'Smartphones',
  slug: 'smartphones',
  isVisible: true,
  productCount: 1
};
const product = {
  id: 'phone',
  name: 'Téléphone professionnel très longue référence 256 Go',
  slug: 'phone',
  status: 'published',
  category,
  variant: {
    id: 'variant',
    name: 'Standard',
    sku: 'PHONE-256',
    priceMillimes: 900000,
    stockQuantity: 0,
    lowStockThreshold: 3
  }
};
const orders = [1, 2].map((index) => ({
  id: `order-${index}`,
  reference: `ED-2026-01234567890123456789012${index}`,
  status: 'confirmed',
  paymentMethod: 'cash_on_delivery',
  paymentStatus: 'pending',
  subtotalMillimes: 1800000,
  deliveryMillimes: 8000,
  totalMillimes: 1808000,
  createdAt: '2026-11-09T08:00:00Z',
  customer: {
    firstName: 'Amira',
    lastName: `Test ${index}`,
    phone: '22000148',
    address: '10 avenue de la République, résidence Les Jasmins',
    governorate: 'Tunis'
  },
  items: [
    {
      id: `line-${index}`,
      productName: product.name,
      sku: product.variant.sku,
      quantity: 2,
      unitPriceMillimes: 900000,
      lineTotalMillimes: 1800000
    }
  ],
  collectedMillimes: 0,
  refundedMillimes: 0
}));

for (const width of [360, 768, 1440])
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`admin operations ${width} ${colorScheme}`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme });
      await page.addInitScript(() =>
        sessionStorage.setItem('electro-dougaz-admin-token', 'synthetic-test-token')
      );
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      const requests: Array<{
        path: string;
        method: string;
        body: Record<string, unknown> | null;
        search: string;
      }> = [];
      let visible = true,
        emptyDeleted = false,
        quantity = 0;
      let history: Array<Record<string, unknown>> = [];
      await page.route('**/api/v1/**', async (route) => {
        const url = new URL(route.request().url()),
          path = url.pathname.replace('/api/v1', ''),
          method = route.request().method();
        const body = route.request().postDataJSON() as Record<string, unknown> | null;
        requests.push({ path, method, body, search: url.search });
        let data: unknown = [];
        if (path === '/admin/auth/me') data = { role: 'owner', displayName: 'Responsable test' };
        else if (path === '/admin/categories/category' && method === 'PATCH') {
          visible = !!body?.isVisible;
          data = { id: category.id };
        } else if (path === '/admin/categories/empty' && method === 'DELETE') {
          emptyDeleted = true;
          data = { id: 'empty' };
        } else if (path === '/admin/categories')
          data = [
            { ...category, isVisible: visible },
            ...(!emptyDeleted
              ? [
                  {
                    id: 'empty',
                    name: 'Catégorie vide',
                    slug: 'empty',
                    isVisible: true,
                    productCount: 0
                  }
                ]
              : [])
          ];
        else if (path === '/admin/products')
          data = url.searchParams.get('stock') === 'available' ? [] : [product];
        else if (path === '/admin/inventory')
          data = [
            {
              variantId: 'variant',
              productId: 'phone',
              productName: product.name,
              sku: product.variant.sku,
              stockQuantity: quantity,
              lowStockThreshold: 3,
              isLow: quantity <= 3
            }
          ];
        else if (path === '/admin/inventory/adjust') {
          const before = quantity;
          quantity += Number(body?.quantity);
          history = [
            {
              id: 'movement',
              createdAt: '2026-11-09T09:00:00Z',
              productName: product.name,
              variantName: 'Standard',
              sku: product.variant.sku,
              quantityDelta: quantity - before,
              stockBefore: before,
              stockAfter: quantity,
              reason: 'manual_adjustment',
              note: body?.note,
              actor: 'admin@example.test',
              orderReference: null
            }
          ];
          data = { variantId: 'variant', stockQuantity: quantity };
        } else if (path === '/admin/inventory/history') data = history;
        else if (path === '/admin/orders') data = orders;
        else if (path === '/admin/orders/delivery-notes')
          data =
            body?.mode === 'selection'
              ? orders.filter((order) => (body.ids as string[]).includes(order.id))
              : orders;
        await route.fulfill({ json: data });
      });
      page.on('dialog', (dialog) => void dialog.accept());
      await page.goto('/admin/categories');
      await page.getByRole('button', { name: 'Masquer Smartphones', exact: true }).click();
      await expect(
        page.getByText('Catégorie masquée dans la boutique.', { exact: true })
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Supprimer Smartphones', exact: true })
      ).toBeDisabled();
      await page.getByRole('button', { name: 'Afficher Smartphones', exact: true }).click();
      await expect(
        page.getByText('Catégorie visible dans la boutique.', { exact: true })
      ).toBeVisible();
      await page.getByRole('button', { name: 'Supprimer Catégorie vide', exact: true }).click();
      await expect(page.getByText('Catégorie supprimée.', { exact: true })).toBeVisible();
      await page.screenshot({ path: info.outputPath('categories.png'), fullPage: true });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true
      );

      await page.goto('/admin/produits');
      await page.getByLabel('Disponibilité du stock').selectOption('out_of_stock');
      await expect(page.getByText('En rupture', { exact: true })).toBeVisible();
      await page.getByLabel('Disponibilité du stock').selectOption('available');
      await expect(page.getByRole('heading', { name: 'Aucun produit', exact: true })).toBeVisible();
      expect(
        requests.some(
          (request) =>
            request.path === '/admin/products' && request.search.includes('stock=out_of_stock')
        )
      ).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true
      );

      await page.goto('/admin/stock');
      await page.getByLabel('Produit à modifier').selectOption('variant');
      await page.getByLabel(/Nombre d’unités/).fill('5');
      await page
        .getByLabel('Pourquoi modifiez-vous le stock ?')
        .selectOption('Livraison fournisseur reçue');
      await page.getByLabel(/Précisions/).fill('Bon fournisseur 124');
      await page.getByRole('button', { name: 'Enregistrer le changement' }).click();
      await expect(page.getByText('0 → 5', { exact: true })).toBeVisible();
      await expect(page.getByText('admin@example.test', { exact: true })).toBeVisible();
      await page.getByLabel('Mouvements', { exact: false }).selectOption('add');
      await page.getByRole('button', { name: 'Filtrer l’historique' }).click();
      await expect(page.getByText('0 → 5', { exact: true })).toBeVisible();
      await page.screenshot({ path: info.outputPath('stock-history.png'), fullPage: true });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true
      );

      await page.goto('/admin/commandes');
      await page.getByLabel('Sélectionner cette page', { exact: true }).check();
      await page.getByRole('button', { name: 'Préparer la sélection (2/50)', exact: true }).click();
      await expect(page.locator('.print-document')).toHaveCount(2);
      const printButton = page.getByRole('button', {
        name: 'Imprimer / Enregistrer les bons en PDF',
        exact: true
      });
      await expect(printButton).toBeEnabled();
      await expect(page.locator('.document-details p').first()).toHaveCSS(
        'color',
        'rgb(82, 98, 122)'
      );
      expect(
        requests.find((request) => request.path === '/admin/orders/delivery-notes')?.body
      ).toEqual({ mode: 'selection', ids: ['order-1', 'order-2'] });
      await page.screenshot({ path: info.outputPath('batch-preview.png'), fullPage: true });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true
      );
      await page.emulateMedia({ media: 'print' });
      await expect(page.locator('.admin-sidebar')).not.toBeVisible();
      await expect(page.locator('.print-document').first().locator('th').first()).toHaveCSS(
        'background-color',
        'rgb(36, 52, 153)'
      );
      expect(
        await page
          .locator('.print-document img')
          .evaluateAll((images) =>
            images.every((image) => (image as HTMLImageElement).naturalWidth > 0)
          )
      ).toBe(true);
      if (width === 1440 && colorScheme === 'light') {
        const pdf = await page.pdf({
          path: info.outputPath('delivery-notes.pdf'),
          format: 'A4',
          printBackground: true
        });
        expect(pdf.toString('latin1').match(/\/Type \/Page\b/g)?.length).toBe(2);
      }
      await page.screenshot({ path: info.outputPath('print-preview.png'), fullPage: true });
      await page.emulateMedia({ media: 'screen' });
      await page.getByLabel('Commandes du', { exact: true }).fill('2026-11-09');
      await page.getByLabel('Au (inclus)', { exact: true }).fill('2026-11-09');
      await expect(page.locator('.print-document')).toHaveCount(0);
      await page.getByRole('button', { name: 'Préparer la période', exact: true }).click();
      await expect(page.locator('.print-document')).toHaveCount(2);
      expect(
        requests.filter((request) => request.path === '/admin/orders/delivery-notes').at(-1)?.body
      ).toEqual({ mode: 'dates', from: '2026-11-09', to: '2026-11-09' });
      expect(errors).toEqual([]);
    });
  }
