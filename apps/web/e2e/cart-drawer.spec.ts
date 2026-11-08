import { expect, test, type Page } from '@playwright/test';

async function setup(page: Page, empty = false) {
  await page.addInitScript(
    ({ empty }) =>
      localStorage.setItem(
        'electro-dougaz-cart-v2',
        JSON.stringify(
          empty
            ? []
            : [
                {
                  id: 'phone',
                  variantId: 'variant',
                  slug: 'test-phone',
                  name: 'Téléphone de test',
                  price: 100,
                  quantity: 1,
                  stock: 4
                }
              ]
        )
      ),
    { empty }
  );
  await page.route('**/api/v1/**', (route) =>
    route.fulfill({
      json: {
        phone: '',
        whatsapp: '',
        contactEmail: '',
        address: '',
        openingHours: '',
        deliveryMillimes: 8000,
        deliveryEstimate: ''
      }
    })
  );
  await page.goto('/contact');
}
for (const width of [360, 1440]) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`cart drawer works at ${width}px in ${colorScheme}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 800 });
      await page.emulateMedia({ colorScheme });
      await setup(page);
      const trigger = page.getByRole('button', { name: 'Panier, 1 article', exact: true });
      await trigger.click();
      const drawer = page.getByRole('dialog', { name: /Mon panier/ });
      await expect(drawer).toBeVisible();
      await expect(page).toHaveURL(/\/contact$/);
      const close = page.getByRole('button', { name: 'Fermer le panier' });
      await expect(close).toBeFocused();
      await page.keyboard.press('Shift+Tab');
      await expect(page.getByRole('button', { name: 'Continuer mes achats' })).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(close).toBeFocused();
      await drawer.getByLabel(/Quantité/).selectOption('2');
      await expect(drawer.locator('.cart-drawer-total')).toContainText('200,000 DT');
      await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');
      await drawer.evaluate((element) =>
        Promise.all(element.getAnimations().map((animation) => animation.finished))
      );
      const box = (await drawer.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      await expect(drawer.getByRole('link', { name: /Passer la commande/ })).toBeInViewport();
      await page.screenshot({ path: testInfo.outputPath('cart.png'), animations: 'disabled' });
      await page.keyboard.press('Escape');
      await expect(drawer).not.toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Panier, 2 articles', exact: true })
      ).toBeFocused();
      await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
      await page.getByRole('button', { name: 'Panier, 2 articles', exact: true }).click();
      await page.getByRole('button', { name: 'Supprimer Téléphone de test' }).click();
      await expect(page.getByText('Votre panier est vide', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Continuer mes achats' }).click();
      await expect(page).toHaveURL(/\/contact$/);
      expect(
        await page.evaluate(() => JSON.parse(localStorage.getItem('electro-dougaz-cart-v2')!))
      ).toEqual([]);
    });
  }
}
test('checkout leaves the drawer; backdrop and reduced motion work', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await setup(page);
  const trigger = page.getByRole('button', { name: 'Panier, 1 article', exact: true });
  await trigger.click();
  await expect(page.locator('#cart-drawer')).toHaveCSS('animation-name', 'none');
  await page.mouse.click(20, 200);
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await trigger.click();
  await page.getByRole('link', { name: /Passer la commande/ }).click();
  await expect(page).toHaveURL(/\/commande$/);
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
});
test('empty cart opens without navigating on a landscape phone', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await setup(page, true);
  await page.getByRole('button', { name: 'Panier, 0 articles', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Votre panier est vide' })).toBeVisible();
  const continueButton = page.getByRole('button', { name: 'Continuer mes achats' });
  await continueButton.scrollIntoViewIfNeeded();
  await continueButton.click();
  await expect(page).toHaveURL(/\/contact$/);
});

test('a long cart scrolls independently while checkout remains reachable', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.addInitScript(() =>
    localStorage.setItem(
      'electro-dougaz-cart-v2',
      JSON.stringify(
        Array.from({ length: 12 }, (_, index) => ({
          id: `phone-${index}`,
          slug: 'test-phone',
          name: `Téléphone ${index + 1}`,
          price: 100,
          quantity: 1,
          stock: 4
        }))
      )
    )
  );
  await page.route('**/api/v1/**', (route) => route.fulfill({ json: {} }));
  await page.goto('/contact');
  await page.getByRole('button', { name: 'Panier, 12 articles' }).click();
  const drawer = page.getByRole('dialog');
  await expect(drawer.getByRole('link', { name: /Passer la commande/ })).toBeInViewport();
  const last = drawer.getByRole('link', { name: 'Téléphone 12', exact: true });
  await last.scrollIntoViewIfNeeded();
  await expect(last).toBeInViewport();
  expect(
    await page.locator('.cart-drawer-body').evaluate((element) => element.scrollTop)
  ).toBeGreaterThan(0);
  await expect(page.getByRole('button', { name: 'Fermer le panier' })).toBeInViewport();
});
