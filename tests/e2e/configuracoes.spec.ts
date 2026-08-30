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

test('técnico acessa a página de Configurações', async ({ page }) => {
  await loginComoTecnico(page);
  await page.goto('/app/configuracoes');

  await expect(page).toHaveURL(/\/app\/configuracoes$/);
  await expect(page.getByRole('heading', { name: 'Configurações' })).toBeVisible();
});

test('técnico vê aviso de convites restritos na aba Equipe', async ({ page }) => {
  await loginComoTecnico(page);
  await page.goto('/app/configuracoes');

  await page.getByRole('tab', { name: 'Equipe' }).click();

  await expect(page.getByText('Somente o responsável da empresa convida usuários.')).toBeVisible();
});

test('técnico não edita dados da empresa', async ({ page }) => {
  await loginComoTecnico(page);
  await page.goto('/app/configuracoes');

  await page.getByRole('tab', { name: 'Empresa' }).click();

  await expect(page.getByLabel('Nome', { exact: true })).toBeDisabled();
  await expect(page.getByLabel('Identificador')).toBeDisabled();
  await expect(page.getByLabel('CNPJ')).toBeDisabled();
  await expect(page.getByLabel('E-mail principal')).toBeDisabled();
  await expect(page.getByLabel('Telefone')).toBeDisabled();
  await expect(page.getByLabel('Criada em')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Salvar empresa' })).toHaveCount(0);
});
