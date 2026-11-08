import { expect, test } from '@playwright/test';

for (const width of [320, 768, 1440]) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`login brand stays inline at ${width}px in ${colorScheme}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme });
      await page.goto('/admin/connexion');
      const row = page.locator('.admin-login-brand-row');
      const logo = await row.locator('img').boundingBox();
      const name = await row.locator('span').boundingBox();
      expect(logo).not.toBeNull();
      expect(name).not.toBeNull();
      expect(name!.x).toBeGreaterThanOrEqual(logo!.x + logo!.width);
      expect(Math.abs(name!.y + name!.height / 2 - logo!.y - logo!.height / 2)).toBeLessThan(2);
      expect(name!.x + name!.width).toBeLessThanOrEqual(width);
      await expect(
        page.getByText(/Moins de clics|Plus de sérénité|Un espace de travail pensé/)
      ).toHaveCount(0);
      await expect(page.getByRole('heading', { name: 'Se connecter', level: 1 })).toBeVisible();
      await page.screenshot({
        path: testInfo.outputPath('login.png'),
        fullPage: true,
        animations: 'disabled'
      });
    });
  }
}
