import { expect, test } from '@playwright/test';

test('stock shortcut, removal preview and recorded reason work on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.addInitScript(() =>
    sessionStorage.setItem('electro-dougaz-admin-token', 'test-session')
  );
  let stock = 4;
  const adjustments: Array<{ quantity: number; note: string }> = [];
  await page.route('**/api/v1/admin/inventory**', async (route) => {
    if (route.request().method() === 'PATCH') {
      const body = route.request().postDataJSON() as { quantity: number; note: string };
      adjustments.push(body);
      stock += body.quantity;
      return route.fulfill({ json: { variantId: 'variant', stockQuantity: stock } });
    }
    return route.fulfill({
      json: [
        {
          variantId: 'variant',
          productId: 'product',
          productName: 'Téléphone test',
          sku: 'TEL-001',
          stockQuantity: stock,
          lowStockThreshold: 5,
          isLow: stock <= 5
        }
      ]
    });
  });
  await page.goto('/admin/stock');
  await page.getByRole('button', { name: 'Ajuster Téléphone test' }).click();
  await expect(page.getByLabel('Produit à modifier')).toHaveValue('variant');
  await page.getByRole('button', { name: /Retirer du stock/ }).click();
  const quantity = page.getByLabel(/Nombre d’unités/);
  await quantity.fill('5');
  await page
    .getByLabel('Pourquoi modifiez-vous le stock ?')
    .selectOption('Article abîmé ou défectueux');
  const save = page.getByRole('button', { name: 'Enregistrer le changement' });
  await expect(save).toBeDisabled();
  await quantity.fill('2');
  await expect(page.locator('.admin-stock-result dd')).toHaveText('2');
  await save.click();
  await expect(page.getByRole('status')).toContainText('Stock disponible : 2');
  expect(adjustments).toHaveLength(1);
  expect(adjustments[0]).toMatchObject({ quantity: -2, note: 'Article abîmé ou défectueux' });
  await expect(save).toBeDisabled();
  await page.reload();
  await expect(page.getByRole('cell', { name: /2 unités/ })).toBeVisible();
});
