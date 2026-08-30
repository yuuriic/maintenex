import { expect, test, type Page } from '@playwright/test';

const E2E_TECNICO = {
  email: 'e2e-tecnico@example.test',
  password: 'MaintenexE2E!123',
};

async function loginComoTecnico(page: Page) {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(E2E_TECNICO.email);
  await page.locator('input[type="password"]').fill(E2E_TECNICO.password);
  await page.locator('form').getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL('**/app', { timeout: 15_000 });
}

test('técnico acessa o Dashboard', async ({ page }) => {
  await loginComoTecnico(page);
  await page.goto('/app');

  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
});

test('técnico visualiza indicador de equipamentos ativos no Dashboard', async ({ page }) => {
  await loginComoTecnico(page);
  await page.goto('/app');

  await expect(page).toHaveURL(/\/app$/);

  const indicadorEquipamentosAtivos = page.locator('.title-row .badge').filter({ hasText: 'equipamentos ativos' });
  await expect(indicadorEquipamentosAtivos).toBeVisible();
  await expect(indicadorEquipamentosAtivos).toContainText('equipamentos ativos');
  await expect(indicadorEquipamentosAtivos).toContainText('1/1');
});

test('técnico filtra o Dashboard por setor', async ({ page }) => {
  await loginComoTecnico(page);
  await page.goto('/app');

  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

  const filtroSetor = page.getByLabel('Setor', { exact: true });
  await expect(filtroSetor).toBeVisible();
  await filtroSetor.selectOption({ label: 'Setor E2E Local' });

  await expect(filtroSetor).toHaveValue('00000000-0000-4000-8000-000000000302');
  await expect(page.locator('.title-row .badge').filter({ hasText: 'equipamentos ativos' })).toContainText('1/1');
});
