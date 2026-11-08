import { test, expect } from '@playwright/test';
const product = {
  id: 'product-id',
  name: 'Smartphone promotion',
  slug: 'phone',
  status: 'published',
  category: { id: 'category-id', name: 'Smartphones', slug: 'smartphones' },
  variant: {
    id: 'variant-id',
    name: 'Standard',
    priceMillimes: 800000,
    compareAtPriceMillimes: 1000000,
    stockQuantity: 4
  }
};
const order = {
  id: 'order-id',
  reference: 'ED-2026-012345678901234567890123',
  status: 'delivered',
  paymentMethod: 'cash_on_delivery',
  paymentStatus: 'pending',
  totalMillimes: 808000,
  deliveryMillimes: 8000,
  createdAt: '2026-10-22T08:00:00Z',
  customer: {
    firstName: 'Amira',
    lastName: 'Test',
    phone: '22000148',
    address: '10 rue de test',
    governorate: 'Tunis'
  },
  items: [{ id: 'item', productName: product.name, quantity: 1, lineTotalMillimes: 800000 }],
  history: [{ status: 'delivered', at: '2026-10-22T08:00:00Z' }]
};
for (const width of [320, 360, 768, 1024, 1440, 1920])
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`management ${width} ${colorScheme}`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 850 });
      await page.emulateMedia({ colorScheme });
      await page.addInitScript(() =>
        sessionStorage.setItem('electro-dougaz-admin-token', 'test-token')
      );
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      let entries: Array<Record<string, unknown>> = [];
      await page.route('**/api/v1/**', async (route) => {
        const url = new URL(route.request().url()),
          path = url.pathname;
        let data: unknown = [];
        if (path.endsWith('/admin/reports'))
          data = {
            summary: {
              count: 1,
              placed: 808000,
              delivered: 808000,
              received: 0,
              collected: 0,
              refunded: 0,
              awaitingRemittance: 0,
              awaitingCollection: 808000,
              average: 808000,
              cancelled: 0,
              returned: 0
            },
            orders: [{ ...order, paymentStatus: 'pending', received: 0, refunded: 0 }],
            days: [{ day: '2026-10-22', count: 1, total: 808000 }],
            top: [{ name: product.name, quantity: 1, total: 800000 }]
          };
        else if (path.endsWith('/admin/activity'))
          data = [
            {
              id: 'event',
              action: 'payment.recorded',
              entityType: 'order',
              entityId: 'order-id',
              actor: 'admin@example.test',
              createdAt: '2026-10-22T08:00:00Z',
              metadata: { kind: 'collected', amountMillimes: 808000 }
            }
          ];
        else if (path.endsWith('/payments')) {
          if (route.request().method() === 'POST') {
            entries = [
              {
                ...route.request().postDataJSON(),
                id: 'payment',
                createdAt: '2026-10-22T08:00:00Z',
                actor: 'admin@example.test'
              }
            ];
            data = { id: 'payment' };
          } else data = entries;
        } else if (path.endsWith('/admin/orders/order-id')) data = order;
        else if (path.endsWith('/admin/products')) data = [product];
        else if (path.endsWith('/categories')) data = [product.category];
        else if (path.endsWith('/admin/auth/me')) data = { role: 'owner', displayName: 'Admin' };
        await route.fulfill({ json: data });
      });
      for (const route of ['rapports', 'historique', 'promotions', 'commandes/order-id']) {
        await page.goto('/admin/' + route);
        if (route === 'rapports') {
          await expect(page.getByText('Panier moyen livré')).toBeVisible();
          await page.getByRole('button', { name: '7 jours', exact: true }).click();
          await expect(page.getByText('Panier moyen livré')).toBeVisible();
          const download = page.waitForEvent('download');
          await page.getByRole('button', { name: /Exporter cette page CSV/ }).click();
          expect((await download).suggestedFilename()).toBe('commandes-page.csv');
        }
        if (route === 'historique')
          await expect(page.getByText('payment.recorded', { exact: true })).toBeVisible();
        if (route === 'promotions') {
          await expect(page.getByRole('heading', { name: product.name })).toBeVisible();
          await page.getByRole('button', { name: 'Enregistrer la période' }).click();
          await expect(page.getByText('Période enregistrée.')).toBeVisible();
        }
        if (route === 'commandes/order-id') {
          await page.getByLabel('Montant (DT)', { exact: true }).fill('808');
          await page.getByLabel('Référence / motif').fill('Bordereau test');
          await page.getByRole('button', { name: 'Enregistrer le mouvement' }).click();
          await expect(page.getByText('Bordereau test', { exact: true })).toBeVisible();
          await page.emulateMedia({ media: 'print' });
          await expect(page.locator('.print-document')).toBeVisible();
          await page.screenshot({ path: info.outputPath('document.png'), fullPage: true });
          await page.emulateMedia({ media: 'screen' });
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true
        );
        // Form controls must not stretch to the height of neighbouring helper text.
        const controls = await page
          .locator('.report-filters input, .report-filters select, .report-filters button')
          .evaluateAll((elements) =>
            elements.map((element) => {
              const box = element.getBoundingClientRect();
              return {
                height: box.height,
                width: box.width,
                left: box.left,
                right: box.right,
                button: element.tagName === 'BUTTON'
              };
            })
          );
        for (const control of controls) {
          expect(control.height).toBeGreaterThanOrEqual(44);
          expect(control.height).toBeLessThanOrEqual(54);
          expect(control.left).toBeGreaterThanOrEqual(0);
          expect(control.right).toBeLessThanOrEqual(width);
          if (control.button && width > 540) expect(control.width).toBeLessThanOrEqual(300);
        }
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
        await page.screenshot({
          path: info.outputPath(route.replaceAll('/', '-') + '.png'),
          fullPage: true
        });
      }
      expect(errors).toEqual([]);
    });
  }
