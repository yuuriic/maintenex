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

test('técnico vê bloqueio de Empresas sem item na navegação', async ({ page }) => {
  await loginComoTecnico(page);
  await page.goto('/app/empresas');

  await expect(page).toHaveURL(/\/app\/empresas$/);
  await expect(page.getByRole('heading', { name: 'Empresas' })).toBeVisible();
  await expect(page.getByText('Esta área é exclusiva da administração da plataforma.')).toBeVisible();
  await expect(page.locator('aside nav').getByRole('link', { name: 'Empresas' })).toHaveCount(0);
});
