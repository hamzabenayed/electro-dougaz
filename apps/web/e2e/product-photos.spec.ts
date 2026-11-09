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

for (const scenario of ['remove', 'replace', 'retry replacement'] as const) {
  test(`saved product photos: ${scenario}`, async ({ page }) => {
    await mockApi(page);
    let images = [...product.images];
    let deleteAttempts = 0;
    let uploads = 0;
    const writes: string[] = [];
    await page.route('**/api/v1/admin/products/**', async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      const method = request.method();
      if (path.endsWith('/accessories')) return route.fulfill({ json: [] });
      if (method === 'PUT') {
        expect(request.headers()['content-type']).toBe('application/json');
        writes.push('save');
        return route.fulfill({ json: { id: product.id } });
      }
      if (method === 'DELETE') {
        deleteAttempts++;
        // Reproduce Fastify's rejection so this test fails against the old request helper.
        if (
          request.headers()['content-type']?.includes('application/json') &&
          !request.postData()
        ) {
          return route.fulfill({
            status: 400,
            json: { message: 'Body cannot be empty when content-type is application/json' }
          });
        }
        expect(request.headers().authorization).toBe('Bearer photo-test');
        expect(request.postData()).toBeNull();
        if (scenario === 'retry replacement' && deleteAttempts === 1) {
          return route.fulfill({ status: 503, json: { message: 'Temporary photo failure' } });
        }
        images = images.filter((image) => !path.endsWith(`/${image.id}`));
        writes.push('remove');
        return route.fulfill({ json: { id: 'image-one' } });
      }
      if (method === 'POST' && path.endsWith('/images')) {
        expect(request.headers()['content-type']).toBe('application/json');
        const body = request.postDataJSON() as { data: string; alt: string };
        expect(body.data).toBe(photo.toString('base64'));
        expect(body.alt).toBe(product.name);
        uploads++;
        images.push({ id: 'new-image', alt: body.alt });
        writes.push('upload');
        return route.fulfill({ status: 201, json: { id: 'new-image' } });
      }
      return route.fulfill({ json: { ...product, images } });
    });
    await page.goto('/admin/produits/photo-product');
    await expect(page.locator('.saved-photo')).toHaveCount(2);
    await page.locator('.saved-photo').first().getByRole('button').click();
    if (scenario !== 'remove') {
      await page
        .locator('#product-images')
        .setInputFiles({ name: 'replacement.png', mimeType: 'image/png', buffer: photo });
    }
    const save = page.getByRole('button', { name: 'Enregistrer les modifications', exact: true });
    await save.click();
    if (scenario === 'retry replacement') {
      await expect(page.locator('.admin-image-error[role="alert"]')).toContainText(
        'Temporary photo failure'
      );
      expect(uploads).toBe(0);
      await save.click();
    }
    await expect(page).toHaveURL(/\/admin\/produits\?created=1$/);
    expect(deleteAttempts).toBe(scenario === 'retry replacement' ? 2 : 1);
    expect(uploads).toBe(scenario === 'remove' ? 0 : 1);
    expect(writes).toEqual(
      scenario === 'remove'
        ? ['save', 'remove']
        : scenario === 'replace'
          ? ['save', 'remove', 'upload']
          : ['save', 'save', 'remove', 'upload']
    );
    await page.goto('/admin/produits/photo-product');
    await expect(page.locator('.saved-photo')).toHaveCount(scenario === 'remove' ? 1 : 2);
    expect(images.some((image) => image.id === 'image-one')).toBe(false);
  });
}
