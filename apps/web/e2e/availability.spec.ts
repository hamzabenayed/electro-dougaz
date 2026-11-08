import { expect, test } from '@playwright/test';

// Read-only check against a running local API with at least one published product.
test.skip(process.env.TEST_LIVE_CATALOG !== '1', 'Requires a populated local catalogue');
for (const colorScheme of ['light', 'dark'] as const) {
  test(`public availability fits product cards in ${colorScheme}`, async ({ page }, testInfo) => {
    await page.emulateMedia({ colorScheme });
    for (const width of [360, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/recherche');
      const cards = page.locator('.catalog-card');
      await expect(cards.first()).toBeVisible();
      for (const card of await cards.all()) {
        const badge = card.locator('.product-availability');
        await expect(badge).toHaveText(/^(Disponible|Rupture de stock)$/);
        const box = (await badge.boundingBox())!;
        const parent = (await card.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(parent.x);
        expect(box.x + box.width).toBeLessThanOrEqual(parent.x + parent.width);
        if ((await badge.textContent()) === 'Rupture de stock')
          await expect(card.getByRole('button')).toBeDisabled();
      }
      await page.screenshot({ path: testInfo.outputPath(`catalog-${width}.png`), fullPage: true });
      await cards.first().locator('.catalog-card-visual').click();
      await expect(page.locator('.product-detail .product-availability')).toHaveText(
        /^(Disponible|Rupture de stock)$/
      );
      await expect(page.locator('.product-detail')).not.toContainText(/\d+ en stock/);
    }
  });
}
