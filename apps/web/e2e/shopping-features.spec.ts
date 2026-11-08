import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
const pixel = readFileSync('../../public/logo/logo-enhanced.png');
async function mockBrowser(page: Page) {
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.includes('/media/')) {
      await route.fulfill({ body: pixel, contentType: 'image/png' });
      return;
    }
    if (path.endsWith('/orders/track')) {
      await route.fulfill({
        json: {
          reference: 'ED-2026-TEST',
          status: 'shipped',
          history: [
            { status: 'pending', at: '2026-10-20T10:00:00Z' },
            { status: 'shipped', at: '2026-10-21T10:00:00Z' }
          ]
        }
      });
      return;
    }
    if (path.endsWith('/orders/quote')) {
      await route.fulfill({
        json: {
          items: [
            {
              variantId: 'variant-blue',
              name: 'Smartphone Démo — Bleu · 256 Go',
              quantity: 1,
              unitPriceMillimes: 1200000
            }
          ],
          subtotalMillimes: 1200000,
          deliveryMillimes: 8000,
          totalMillimes: 1208000
        }
      });
      return;
    }
    if (path.endsWith('/orders')) {
      await route.fulfill({
        status: 201,
        json: { reference: 'ED-2026-TEST', totalMillimes: 1208000 }
      });
      return;
    }
    await route.fulfill({
      json: { deliveryMillimes: 8000, deliveryEstimate: '2 à 4 jours ouvrables' }
    });
  });
}
for (const width of [360, 768, 1440])
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`shopping journey ${width}px ${colorScheme}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 820 });
      await page.emulateMedia({ colorScheme });
      await mockBrowser(page);
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto('/promotions');
      await expect(page.locator('.inner-brand:visible')).toHaveCount(1);
      const brand = await page.locator('.inner-brand:visible').boundingBox();
      const cart = await page.locator('.inner-header:visible .cart-action:visible').boundingBox();
      expect(brand && cart && brand.x + brand.width <= cart.x).toBeTruthy();
      await expect(page.getByRole('heading', { name: 'Promotions', exact: true })).toBeVisible();
      await expect(page.getByText('−20 %')).toBeVisible();
      await page.getByRole('link', { name: 'Choisir', exact: true }).click();
      await page.getByRole('button', { name: 'Photo 2', exact: true }).click();
      await page.getByRole('button', { name: 'Agrandir la photo du produit' }).click();
      await expect(page.getByRole('dialog', { name: 'Photo agrandie' })).toBeVisible();
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: /Rouge · 256 Go/ }).click();
      await expect(page.getByRole('button', { name: /Ajouter .* au panier/ })).toBeDisabled();
      await page.getByRole('button', { name: /Bleu · 256 Go/ }).click();
      await expect(page.locator('.detail-price')).toContainText('1');
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await page.screenshot({ path: testInfo.outputPath('product.png'), fullPage: true });
      await page.getByRole('button', { name: 'Acheter maintenant' }).click();
      await expect(page).toHaveURL(/commande$/);
      await page.getByRole('button', { name: 'Confirmer la commande' }).click();
      await expect(page.locator('#firstName-error')).toContainText('2 caractères');
      await page.getByLabel('Prénom', { exact: true }).fill('Amira');
      await page.getByLabel('Nom', { exact: true }).fill('Client');
      await page.getByLabel('Téléphone', { exact: true }).fill('22000148');
      await page.getByLabel('Gouvernorat', { exact: true }).selectOption('Tunis');
      await page.getByLabel('Adresse', { exact: true }).fill('10 rue de test');
      await expect(page.locator('[aria-invalid="true"]')).toHaveCount(0);
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await page.screenshot({ path: testInfo.outputPath('checkout.png'), fullPage: true });
      await page.getByRole('button', { name: 'Confirmer la commande' }).click();
      await expect(
        page.getByRole('heading', { name: 'Demande de commande enregistrée' })
      ).toBeVisible();
      await expect(page.getByRole('button', { name: 'Suivre ma commande' })).toBeDisabled();
      await expect(page.getByLabel('Votre référence de commande')).toHaveValue('ED-2026-TEST');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath('confirmation.png'), fullPage: true });
      await page.evaluate(() => {
        Object.defineProperty(navigator, 'clipboard', {
          configurable: true,
          value: { writeText: async () => undefined }
        });
      });
      await page.getByRole('button', { name: 'Copier la référence' }).click();
      await page.getByRole('link', { name: 'Suivre ma commande' }).click();
      await page.getByLabel('Référence de commande').fill('ED-2026-TEST');
      await page.getByLabel('Numéro de téléphone').fill('22000148');
      await page.getByRole('button', { name: 'Afficher le suivi' }).click();
      await expect(page.locator('[aria-current=step]')).toContainText('Expédiée');
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await page.screenshot({ path: testInfo.outputPath('tracking.png'), fullPage: true });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true
      );
      expect(errors).toEqual([]);
    });
  }
test('filters preserve the query and show a recoverable empty state', async ({ page }) => {
  await mockBrowser(page);
  await page.goto('/recherche');
  await page.getByRole('searchbox', { name: 'Recherche', exact: true }).fill('introuvable');
  await page.getByRole('button', { name: 'Appliquer les filtres' }).click();
  await expect(page.getByRole('heading', { name: 'Aucun produit trouvé' })).toBeVisible();
  await expect(page.locator('.catalog-filters:visible input[name="q"]')).toHaveValue('introuvable');
  await page.getByRole('link', { name: 'Réinitialiser les filtres' }).first().click();
  await expect(page.getByRole('link', { name: 'Smartphone Démo', exact: true })).toBeVisible();
});
