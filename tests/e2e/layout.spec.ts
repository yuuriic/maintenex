import { expect, test } from '@playwright/test';

test('sidebar permanece fixa enquanto o conteúdo rola', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill('e2e-owner@example.test');
  await page.locator('input[type="password"]').fill('MaintenexE2E!123');
  await page.locator('form').getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL('**/app');
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

  const viewport = page.viewportSize();
  const sidebar = page.locator('.shell > aside');
  const content = page.locator('.content');
  const logout = page.getByRole('button', { name: 'Sair', exact: true });
  const beforeSidebar = await sidebar.boundingBox();
  const beforeLogout = await logout.boundingBox();

  expect(viewport).not.toBeNull();
  expect(beforeSidebar).not.toBeNull();
  expect(beforeLogout).not.toBeNull();
  expect(beforeSidebar!.y).toBe(0);
  expect(beforeSidebar!.height).toBeGreaterThanOrEqual(viewport!.height - 1);
  expect(beforeLogout!.y + beforeLogout!.height).toBeLessThanOrEqual(viewport!.height);

  await content.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect.poll(() => content.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);

  const afterSidebar = await sidebar.boundingBox();
  const afterLogout = await logout.boundingBox();
  expect(afterSidebar).not.toBeNull();
  expect(afterLogout).not.toBeNull();
  expect(Math.abs(afterSidebar!.y - beforeSidebar!.y)).toBeLessThan(1);
  expect(Math.abs(afterLogout!.y - beforeLogout!.y)).toBeLessThan(1);
  expect(afterLogout!.y + afterLogout!.height).toBeLessThanOrEqual(viewport!.height);
});
