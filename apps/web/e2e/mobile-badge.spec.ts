import { expect, test } from '@playwright/test';

for (const width of [320, 390, 760]) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`navigation clears hosting badge at ${width}px ${colorScheme}`, async ({
      page
    }, testInfo) => {
      await page.setViewportSize({ width, height: 800 });
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await page.goto('/');
      // Simulate the provider's collapsed overlay without depending on its private DOM.
      await page.evaluate(() => {
        const badge = document.createElement('div');
        badge.id = 'test-hosting-badge';
        badge.textContent = 'Powered by Netlify';
        Object.assign(badge.style, {
          position: 'fixed',
          right: '16px',
          bottom: '12px',
          width: '180px',
          height: '40px',
          zIndex: '2147483647',
          background: '#102a32',
          color: 'white',
          borderRadius: '24px',
          display: 'grid',
          placeItems: 'center',
          fontSize: '12px'
        });
        document.body.append(badge);
      });
      const navigation = page.getByRole('navigation', { name: 'Navigation mobile' });
      const navBox = (await navigation.boundingBox())!;
      const badgeBox = (await page.locator('#test-hosting-badge').boundingBox())!;
      expect(navBox.y + navBox.height).toBeLessThanOrEqual(badgeBox.y);
      for (const control of await navigation.locator('a, button').all()) {
        const box = (await control.boundingBox())!;
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(
          await control.evaluate((element) => {
            const bounds = element.getBoundingClientRect();
            return element.contains(
              document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
            );
          })
        ).toBe(true);
      }
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      const footer = (await page.locator('footer').boundingBox())!;
      expect(footer.y + footer.height).toBeLessThanOrEqual(navBox.y);
      await page.screenshot({ path: testInfo.outputPath('badge-clearance.png') });
      await navigation.getByRole('button', { name: /Panier/ }).click();
      await expect(page.getByRole('dialog', { name: /Mon panier/ })).toBeVisible();
      await page.getByRole('button', { name: 'Fermer le panier' }).click();
      await navigation.getByRole('link', { name: 'Suivi' }).click();
      await expect(page).toHaveURL(/\/suivi-commande$/);
    });
  }
}
