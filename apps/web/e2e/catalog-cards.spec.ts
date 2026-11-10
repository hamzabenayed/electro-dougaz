import { expect, test } from '@playwright/test';

for (const width of [320, 390, 768, 1440]) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`consistent cards ${width}px ${colorScheme}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await page.route('**/api/v1/media/**', (route) =>
        route.fulfill({
          contentType: 'image/svg+xml',
          body: '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="300" viewBox="0 0 180 300"><rect x="20" y="5" width="140" height="290" rx="20" fill="#172477"/><rect x="30" y="25" width="120" height="245" rx="8" fill="#e9edff"/><circle cx="90" cy="282" r="6" fill="#fff"/></svg>'
        })
      );
      await page.goto('/recherche?q=card-showcase');
      const cards = page.locator('.catalog-card');
      await expect(cards).toHaveCount(3);
      await expect(cards.first().locator('.product-promotion')).toHaveText('−20 %');
      await expect(cards.nth(1).locator('.product-promotion')).toHaveCount(0);
      await expect(cards.last().getByRole('button')).toBeDisabled();
      for (const card of await cards.all()) {
        const frame = (await card.locator('.catalog-card-image').boundingBox())!;
        expect(frame.width / frame.height).toBeCloseTo(4 / 3, 1);
        const badges = (await card.locator('.catalog-card-badges').boundingBox())!;
        expect(badges.y + badges.height).toBeLessThanOrEqual(frame.y);
        const action = (await card.locator('.product-footer > button').boundingBox())!;
        const bounds = (await card.boundingBox())!;
        expect(action.height).toBeGreaterThanOrEqual(44);
        expect(action.x).toBeGreaterThan(bounds.x);
        expect(action.x + action.width).toBeLessThan(bounds.x + bounds.width);
        expect(
          await card.evaluate((element) => parseFloat(getComputedStyle(element).transitionDuration))
        ).toBeLessThanOrEqual(0.001);
      }
      if (width >= 1440) {
        const boxes = await Promise.all((await cards.all()).map((card) => card.boundingBox()));
        expect(
          Math.max(...boxes.map((b) => b!.height)) - Math.min(...boxes.map((b) => b!.height))
        ).toBeLessThan(2);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true
      );
      await cards.first().scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath('cards.png') });
      await cards.first().getByRole('button').click();
      await expect(cards.first().getByRole('button')).toContainText('Ajouté');
      await page.goto('/promotions');
      await expect(
        page.locator('.catalog-card').getByRole('link', { name: 'Choisir', exact: true })
      ).toBeVisible();
    });
  }
}
