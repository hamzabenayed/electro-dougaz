import { expect, test } from '@playwright/test';

const initial = {
  phone: '',
  whatsapp: '',
  contactEmail: '',
  address: '',
  openingHours: '',
  deliveryMillimes: 8000,
  deliveryEstimate: '',
  notificationEmail: '',
  revision: 0
};

test('owner saves settings, reloads them, cancels a draft, and sees public information', async ({
  page
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.addInitScript(() =>
    sessionStorage.setItem('electro-dougaz-admin-token', 'fixture-token')
  );
  let stored = { ...initial };
  let writes = 0;
  await page.route('**/api/v1/**', async (route) => {
    const endpoint = new URL(route.request().url()).pathname;
    if (endpoint.endsWith('/auth/me')) return route.fulfill({ json: { role: 'owner' } });
    if (endpoint.endsWith('/admin/settings')) {
      if (route.request().method() === 'PUT') {
        writes++;
        stored = { ...route.request().postDataJSON(), revision: stored.revision + 1 };
      }
      return route.fulfill({ json: stored });
    }
    const { notificationEmail, revision, ...publicData } = stored;
    void notificationEmail;
    void revision;
    return route.fulfill({ json: publicData });
  });
  await page.goto('/admin/parametres');
  await page.getByLabel('Téléphone', { exact: true }).fill('+216 22000148');
  await page.getByLabel('Frais de livraison (DT)', { exact: false }).fill('12.345');
  await page.getByLabel('E-mail de notification').fill('private@example.test');
  await page.getByRole('button', { name: 'Enregistrer les modifications' }).click();
  await expect(page.getByText('Paramètres enregistrés', { exact: true })).toBeVisible();
  expect(stored.deliveryMillimes).toBe(12345);
  await page.setViewportSize({ width: 1440, height: 900 });
  const phoneBox = await page.getByLabel('Téléphone', { exact: true }).boundingBox();
  const whatsappBox = await page.getByLabel('WhatsApp', { exact: false }).boundingBox();
  expect(Math.abs(phoneBox!.y - whatsappBox!.y)).toBeLessThan(2);
  expect(Math.abs(phoneBox!.height - whatsappBox!.height)).toBeLessThan(2);
  await page.reload();
  await expect(page.getByLabel('Téléphone', { exact: true })).toHaveValue('+216 22000148');
  await page.getByLabel('Téléphone', { exact: true }).fill('+216 22000999');
  await page.getByRole('button', { name: 'Annuler', exact: true }).click();
  await expect(page.getByLabel('Téléphone', { exact: true })).toHaveValue('+216 22000148');
  expect(writes).toBe(1);
  await page.goto('/contact');
  await expect(page.getByRole('link', { name: '+216 22000148', exact: true })).toHaveAttribute(
    'href',
    'tel:+21622000148'
  );
  await expect(page.getByText('private@example.test')).toHaveCount(0);
});

test('staff settings view is read-only and excludes internal notification settings', async ({
  page
}) => {
  await page.addInitScript(() =>
    sessionStorage.setItem('electro-dougaz-admin-token', 'fixture-token')
  );
  let privateRequests = 0;
  await page.route('**/api/v1/**', async (route) => {
    const endpoint = new URL(route.request().url()).pathname;
    if (endpoint.endsWith('/admin/settings')) privateRequests++;
    await route.fulfill({
      json: endpoint.endsWith('/auth/me') ? { role: 'fulfillment' } : initial
    });
  });
  await page.goto('/admin/parametres');
  await expect(page.getByText('Lecture seule', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Téléphone', { exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Enregistrer les modifications' })).toHaveCount(0);
  await expect(page.getByLabel('E-mail de notification')).toHaveCount(0);
  expect(privateRequests).toBe(0);
});
