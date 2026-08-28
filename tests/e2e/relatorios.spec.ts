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

test('técnico acessa a página de Relatórios', async ({ page }) => {
  await loginComoTecnico(page);
  await page.goto('/app/relatorios');

  await expect(page).toHaveURL(/\/app\/relatorios$/);
  await expect(page.getByRole('heading', { name: 'Relatórios' })).toBeVisible();
});

test('técnico visualiza total de checklists no período em Relatórios', async ({ page }) => {
  await loginComoTecnico(page);
  await page.goto('/app/relatorios');

  await expect(page).toHaveURL(/\/app\/relatorios$/);

  const cardChecklists = page.locator('article.card').filter({ hasText: 'Checklists no período' });
  await expect(cardChecklists).toBeVisible();
  await expect(cardChecklists.locator('.card-topo')).toContainText('Checklists no período');
  await expect(cardChecklists.locator('strong')).toHaveText('0');
});

test('técnico filtra Relatórios por período', async ({ page }) => {
  await loginComoTecnico(page);
  await page.goto('/app/relatorios');

  await expect(page).toHaveURL(/\/app\/relatorios$/);
  await expect(page.getByRole('heading', { name: 'Relatórios' })).toBeVisible();

  const filtroPeriodo = page.locator('.title-row .acoes-topo select');
  await expect(filtroPeriodo).toHaveValue('90');
  await expect(page.locator('.title-row p')).toContainText('últimos 90 dias');

  await filtroPeriodo.selectOption({ label: 'Últimos 30 dias' });

  await expect(filtroPeriodo).toHaveValue('30');
  await expect(page.locator('.title-row p')).toContainText('últimos 30 dias');
  await expect(page.locator('article.card').filter({ hasText: 'Checklists no período' }).locator('strong')).toHaveText('0');
  await expect(page.locator('article.card').filter({ hasText: 'Taxa de conclusão' }).locator('strong')).toHaveText('0%');
  await expect(page.getByText('Sem saídas no período')).toBeVisible();
});
