import { expect, test } from '@playwright/test';

for (const width of [320, 390, 768, 1440]) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`autocomplete ${width}px ${colorScheme}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await page.route('**/api/v1/categories', (route) =>
        route.fulfill({ json: [{ id: 'c', name: 'Smartphones', slug: 'smartphones' }] })
      );
      await page.route('**/api/v1/products?*', (route) => {
        const q = new URL(route.request().url()).searchParams.get('q');
        return route.fulfill({
          json:
            q === 'missing'
              ? []
              : [
                  {
                    id: 'fixture-product',
                    slug: 'smartphone-demo',
                    name: 'Smartphone Démo',
                    category: { name: 'Smartphones' },
                    variant: {
                      id: 'variant-black',
                      priceMillimes: 800000,
                      compareAtPriceMillimes: 1000000,
                      stockQuantity: 5
                    }
                  }
                ]
        });
      });
      await page.goto('/');
      const search = page.locator('.store-search:visible');
      const input = search.getByRole('combobox');
      await input.click();
      await expect(search.getByRole('option', { name: 'Smartphones Catégorie' })).toBeVisible();
      await input.fill('smart');
      const product = search.getByRole('option', { name: /Smartphone Démo/ });
      await expect(product).toBeVisible();
      await expect(product).toContainText('800,000');
      const bounds = (await search.locator('.search-suggestions').boundingBox())!;
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true
      );
      await page.screenshot({ path: testInfo.outputPath('suggestions.png') });
      await input.press('ArrowDown');
      await input.press('ArrowDown');
      await expect(product).toHaveAttribute('aria-selected', 'true');
      await input.press('Escape');
      await expect(search.getByRole('listbox')).toBeHidden();
      await input.fill('missing');
      await expect(search.getByRole('status')).toContainText('Aucun résultat');
      await input.fill('smart');
      await expect(product).toBeVisible();
      await product.click();
      await expect(page).toHaveURL(/\/produits\/smartphone-demo\?option=variant-black/);
      const inner = page.locator('.inner-search:visible');
      await inner.getByRole('combobox').fill('smart');
      await expect(inner.getByRole('option', { name: /Smartphone Démo/ })).toBeVisible();
      const innerBox = (await inner.locator('.search-suggestions').boundingBox())!;
      expect(innerBox.x + innerBox.width).toBeLessThanOrEqual(width);
    });
  }
}
