import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
const image = readFileSync('../../public/logo/logo-enhanced.png');

for (const width of [320, 390, 768, 1440]) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`homepage offers fit ${width}px ${colorScheme}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await page.route('**/api/v1/media/**', (route) =>
        route.fulfill({ body: image, contentType: 'image/png' })
      );
      await page.goto('/');
      const hero = page.getByRole('region', { name: 'Promotions à découvrir' });
      await expect(hero).toBeVisible();
      await expect(page.locator('.hero-copy:visible h1')).toContainText('À prix coup de cœur.');
      await expect(hero.locator('.hero-offer-stock')).toContainText('Disponible');
      expect(await hero.evaluate((element) => getComputedStyle(element).animationName)).toBe(
        'none'
      );
      const imageBox = await hero.locator('.hero-offer-product').boundingBox();
      expect(imageBox!.height).toBeGreaterThan(100);
      if (width >= 1440) {
        await expect(page.locator('.nav-offer-label')).toBeVisible();
        const header = await page.locator('.header-main').boundingBox();
        expect(header!.width).toBeLessThan(width);
      }
      await expect(hero.locator('del')).toBeVisible();
      await expect(hero.locator('.product-promotion')).toHaveText('−20 %');
      await expect(hero.getByRole('button')).toHaveCount(0);
      const panel = page.locator('.offers-panel:visible');
      await panel.scrollIntoViewIfNeeded();
      const bounds = await panel.boundingBox();
      expect(bounds!.x).toBeGreaterThan(0);
      expect(bounds!.x + bounds!.width).toBeLessThan(width);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
      ).toBe(true);
      await expect(panel.locator('.catalog-card')).toHaveCount(1);
      await page.screenshot({ path: testInfo.outputPath('promotions.png') });
      await hero.scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath('hero.png') });
      await expect(hero.getByRole('link')).toHaveAttribute('href', /option=variant-black/);
    });
  }
}
