import { expect, test } from '@playwright/test';

for (const width of [320, 360, 390, 430, 760, 768, 1440]) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`header stays separated at ${width}px ${colorScheme}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 850 });
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await page.addInitScript(() =>
        localStorage.setItem(
          'electro-dougaz-cart-v2',
          JSON.stringify([
            {
              id: 'test-phone',
              slug: 'test-phone',
              name: 'Téléphone de test',
              price: 9999,
              quantity: 10,
              stock: 10
            }
          ])
        )
      );
      await page.route('**/api/v1/**', (route) => route.fulfill({ json: {} }));
      await page.goto('/');
      const header = page.locator('.header-main:visible');
      const cart = header.getByRole('button', { name: 'Panier, 10 articles', exact: true });
      await expect(cart).toBeVisible();
      await expect(cart.locator('b')).toHaveText('10');
      const brand = await header.locator('.brand').boundingBox();
      const cartBox = await cart.boundingBox();
      expect(brand!.x + brand!.width + 4).toBeLessThanOrEqual(cartBox!.x);
      expect(cartBox!.width).toBeGreaterThanOrEqual(44);
      expect(cartBox!.height).toBeGreaterThanOrEqual(44);
      if (width <= 760) {
        const menu = await header.locator('.mobile-menu').boundingBox();
        expect(menu!.x + menu!.width + 4).toBeLessThanOrEqual(brand!.x);
        expect(menu!.width).toBeGreaterThanOrEqual(44);
        await expect(header.locator('.brand-name')).toBeVisible();
        await expect(page.locator('.announcement:visible .announcement-note')).toBeHidden();
        const search = page.locator('.mobile-search:visible');
        const input = await search.getByRole('combobox').boundingBox();
        const submit = await search.getByRole('button').boundingBox();
        expect(input!.width).toBeGreaterThan(100);
        expect(input!.x + input!.width).toBeLessThanOrEqual(submit!.x);
        expect(submit!.width).toBeGreaterThanOrEqual(44);
        expect(submit!.height).toBeGreaterThanOrEqual(44);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true
      );
      await page.screenshot({ path: testInfo.outputPath('header.png'), animations: 'disabled' });
      await cart.click();
      await expect(page.getByRole('dialog', { name: /Mon panier/ })).toBeVisible();
      await page.getByRole('button', { name: 'Fermer le panier' }).click();
      await expect(cart).toBeFocused();
      if (width <= 760) {
        await page.locator('.mobile-search:visible').getByRole('combobox').fill('Smartphone');
        await page.locator('.mobile-search:visible').getByRole('button').click();
        await expect(page).toHaveURL(/\/recherche\?q=Smartphone/);
      }
    });
  }
}
