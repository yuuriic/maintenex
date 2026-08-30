import { expect, test, type Page } from '@playwright/test';

const E2E_TECNICO = {
  email: 'e2e-tecnico@example.test',
  password: 'MaintenexE2E!123',
};

const E2E_SUPER_ADMIN = {
  email: 'e2e-super-admin@example.test',
  password: 'MaintenexE2E!123',
};

async function loginComoTecnico(page: Page) {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(E2E_TECNICO.email);
  await page.locator('input[type="password"]').fill(E2E_TECNICO.password);
  await page.locator('form').getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL('**/app', { timeout: 15_000 });
}

async function loginComoSuperAdmin(page: Page) {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(E2E_SUPER_ADMIN.email);
  await page.locator('input[type="password"]').fill(E2E_SUPER_ADMIN.password);
  await page.locator('form').getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL('**/app', { timeout: 15_000 });
}

test('técnico vê bloqueio de Empresas sem item na navegação', async ({ page }) => {
  await loginComoTecnico(page);
  await page.goto('/app/empresas');

  await expect(page).toHaveURL(/\/app\/empresas$/);
  await expect(page.getByRole('heading', { name: 'Empresas' })).toBeVisible();
  await expect(page.getByText('Esta área é exclusiva da administração da plataforma.')).toBeVisible();
  await expect(page.locator('aside nav').getByRole('link', { name: 'Empresas' })).toHaveCount(0);
});

test('super admin acessa área administrativa de Empresas', async ({ page }) => {
  await loginComoSuperAdmin(page);
  await page.goto('/app/empresas');

  await expect(page).toHaveURL(/\/app\/empresas$/);
  await expect(page.getByText(/Administração da plataforma · \d+ empresa\(s\)/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Empresas' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Nova empresa' })).toBeVisible();
});

test('super admin busca empresa E2E existente', async ({ page }) => {
  await loginComoSuperAdmin(page);
  await page.goto('/app/empresas');

  await expect(page).toHaveURL(/\/app\/empresas$/);

  const empresaSeed = page.getByRole('row', { name: /Maintenex E2E Local/ });
  await expect(empresaSeed).toBeVisible();
  await expect(empresaSeed.getByText('Maintenex E2E Local')).toBeVisible();

  await page.getByPlaceholder('Buscar empresa, CNPJ ou e-mail…').fill('Maintenex E2E Local');

  await expect(empresaSeed).toBeVisible();
  await expect(empresaSeed.getByText('Maintenex E2E Local')).toBeVisible();
});
