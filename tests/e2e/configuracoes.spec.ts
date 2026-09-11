import { expect, test, type Page } from '@playwright/test';

const E2E_TECNICO = {
  email: 'e2e-tecnico@example.test',
  password: 'MaintenexE2E!123',
};
const E2E_OWNER = {
  email: 'e2e-owner@example.test',
  password: 'MaintenexE2E!123',
};

async function loginComoTecnico(page: Page) {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(E2E_TECNICO.email);
  await page.locator('input[type="password"]').fill(E2E_TECNICO.password);
  await page.locator('form').getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL('**/app', { timeout: 15_000 });
}

async function loginComoOwner(page: Page) {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(E2E_OWNER.email);
  await page.locator('input[type="password"]').fill(E2E_OWNER.password);
  await page.locator('form').getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL('**/app', { timeout: 15_000 });
}

test('técnico acessa a página de Configurações', async ({ page }) => {
  await loginComoTecnico(page);
  await page.goto('/app/configuracoes');

  await expect(page).toHaveURL(/\/app\/configuracoes$/);
  await expect(page.getByRole('heading', { name: 'Configurações' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Dashboard' })).toHaveCount(0);
});

test('responsável personaliza e persiste o Dashboard da empresa', async ({ page }) => {
  await loginComoOwner(page);
  await page.goto('/app/configuracoes');
  await page.getByRole('tab', { name: 'Dashboard' }).click();

  await expect(page.getByText('Biblioteca SalesOps + Grafana')).toBeVisible();
  await expect(page.getByText('Catálogo com 62 opções.')).toBeVisible();

  const titulo = page.getByLabel('Título do quadro 1');
  await titulo.fill('Dashboard E2E');
  await page.getByRole('button', { name: 'Salvar dashboard' }).click();
  await expect(page.getByText('Dashboard personalizado salvo para a empresa.')).toBeVisible();

  await page.reload();
  await page.getByRole('tab', { name: 'Dashboard' }).click();
  await expect(page.getByLabel('Título do quadro 1')).toHaveValue('Dashboard E2E');

  await page.getByRole('button', { name: 'Restaurar padrão' }).click();
  await page.getByRole('button', { name: 'Salvar dashboard' }).click();
  await expect(page.getByText('Dashboard personalizado salvo para a empresa.')).toBeVisible();
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
