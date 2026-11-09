import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const photo = readFileSync('../../public/logo/logo-enhanced.png');
const product = {
  id: 'photo-product',
  slug: 'smartphone-demo',
  name: 'Smartphone avec une longue référence professionnelle — 256 Go',
  description: 'Produit de test',
  status: 'published',
  category: { id: 'category', name: 'Smartphones', slug: 'smartphones' },
  variant: {
    id: 'variant',
    name: 'Standard',
    sku: 'PHOTO-001',
    priceMillimes: 1500000,
    stockQuantity: 5,
    lowStockThreshold: 2
  },
  images: [
    { id: 'image-one', alt: 'Téléphone face' },
    { id: 'image-two', alt: 'Téléphone dos' }
  ]
};

async function mockApi(page: Page) {
  await page.addInitScript(() =>
    sessionStorage.setItem('electro-dougaz-admin-token', 'photo-test')
  );
  await page.route('**/api/v1/**', async (route) => {
    const endpoint = new URL(route.request().url()).pathname.replace('/api/v1', '');
    if (endpoint.includes('/media/')) {
      await route.fulfill({
        body: photo,
        contentType: 'image/png',
        headers: { 'Cross-Origin-Resource-Policy': 'cross-origin' }
      });
      return;
    }
    const data =
      endpoint === '/admin/auth/me'
        ? { displayName: 'Test', email: 'photo@example.test', role: 'owner' }
        : endpoint.includes('/categories')
          ? [product.category]
          : endpoint.endsWith('/accessories')
            ? []
            : endpoint === '/admin/products/photo-product'
              ? product
              : endpoint === '/admin/products'
                ? [product]
                : { deliveryMillimes: 8000 };
    await route.fulfill({ json: data });
  });
}

for (const width of [320, 768, 1440]) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`uploaded photo layout ${width}px ${colorScheme}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await mockApi(page);

      await page.goto('/');
      const cardPhoto = page.locator('.catalog-card-visual img').first();
      await cardPhoto.scrollIntoViewIfNeeded();
      await expect(cardPhoto).toHaveAttribute('src', /\/api\/v1\/media\/image-one$/);
      await expect
        .poll(() =>
          cardPhoto.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)
        )
        .toBe(true);
      await page.goto('/produits/smartphone-demo');
      const gallery = page.locator('.gallery-main:visible img');
      await expect
        .poll(() =>
          gallery.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)
        )
        .toBe(true);
      await page.getByRole('button', { name: 'Photo 2', exact: true }).click();
      await expect(gallery).toHaveAttribute('src', /\/media\/image-two$/);

      await page.goto('/admin/produits');
      const image = page.locator('.admin-product-thumb img');
      await expect(image).toHaveAttribute('src', /^blob:/);
      await expect
        .poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0))
        .toBe(true);
      const frame = await page.locator('.admin-product-thumb').boundingBox();
      const picture = await image.boundingBox();
      const title = await page.locator('.admin-product-cell strong').boundingBox();
      expect(frame).not.toBeNull();
      expect(picture).not.toBeNull();
      expect(title).not.toBeNull();
      expect(picture!.x).toBeGreaterThanOrEqual(frame!.x);
      expect(picture!.y).toBeGreaterThanOrEqual(frame!.y);
      expect(picture!.x + picture!.width).toBeLessThanOrEqual(frame!.x + frame!.width + 1);
      expect(picture!.y + picture!.height).toBeLessThanOrEqual(frame!.y + frame!.height + 1);
      expect(title!.x).toBeGreaterThanOrEqual(frame!.x + frame!.width + 8);
      await page.screenshot({ path: testInfo.outputPath('product-list.png'), fullPage: true });

      await page.goto('/admin/produits/photo-product');
      await expect(page.locator('.saved-photo img')).toHaveCount(2);
      for (const row of await page.locator('.saved-photo').all()) {
        const img = row.locator('img');
        await expect(img).toHaveAttribute('src', /^blob:/);
        const name = await row.locator(':scope > span').boundingBox();
        const box = await img.boundingBox();
        expect(name!.x).toBeGreaterThanOrEqual(box!.x + box!.width + 8);
        expect(
          await row.locator('button').evaluate((button) => button.getBoundingClientRect().height)
        ).toBeGreaterThanOrEqual(44);
      }
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)
      ).toBe(true);
      await page.locator('.saved-photo').first().scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath('product-photos.png'), fullPage: true });
    });
  }
}

test('saved and newly selected photos share the eight-photo limit', async ({ page }) => {
  await mockApi(page);
  await page.goto('/admin/produits/photo-product');
  await expect(page.locator('.saved-photo')).toHaveCount(2);
  const file = (index: number) => ({
    name: `photo-${index}.png`,
    mimeType: 'image/png',
    buffer: photo
  });
  await page
    .locator('#product-images')
    .setInputFiles(Array.from({ length: 7 }, (_, index) => file(index)));
  await expect(page.locator('.admin-image-error[role="alert"]')).toContainText('8 photos');
  await expect(page.locator('.admin-image-preview')).toHaveCount(0);
  await page
    .locator('#product-images')
    .setInputFiles(Array.from({ length: 6 }, (_, index) => file(index)));
  await expect(page.locator('.admin-image-preview')).toHaveCount(6);
});
