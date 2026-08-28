import { expect, test } from '@playwright/test';

const E2E_TECNICO = {
  email: 'e2e-tecnico@example.test',
  password: 'MaintenexE2E!123',
};

async function loginComoTecnico(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(E2E_TECNICO.email);
  await page.locator('input[type="password"]').fill(E2E_TECNICO.password);
  await page.locator('form').getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL('**/app', { timeout: 15_000 });
}

test('técnico acessa a página de Equipamentos', async ({ page }) => {
  await loginComoTecnico(page);
  await page.goto('/app/equipamentos');

  await expect(page).toHaveURL(/\/app\/equipamentos$/);
  await expect(page.getByRole('heading', { name: 'Equipamentos' })).toBeVisible();
});

test('técnico visualiza equipamento E2E existente', async ({ page }) => {
  await loginComoTecnico(page);
  await page.goto('/app/equipamentos');

  await expect(page).toHaveURL(/\/app\/equipamentos$/);

  const equipamentoE2E = page.getByRole('row', { name: /E2E-CHK-001/ });
  await expect(equipamentoE2E).toBeVisible();
  await expect(equipamentoE2E).toContainText('E2E-CHK-001');
  await expect(equipamentoE2E).toContainText('Equipamento Checklist E2E');
});

test('técnico abre detalhes do equipamento E2E existente pela ação disponível', async ({ page }) => {
  await loginComoTecnico(page);
  await page.goto('/app/equipamentos');

  await expect(page).toHaveURL(/\/app\/equipamentos$/);

  const equipamentoE2E = page.getByRole('row', { name: /E2E-CHK-001/ });
  await expect(equipamentoE2E).toBeVisible();

  await equipamentoE2E.getByRole('button', { name: 'Editar' }).click();

  const detalhesEquipamento = page.getByRole('dialog', { name: 'Editar equipamento' });
  await expect(detalhesEquipamento).toBeVisible();
  await expect(page).toHaveURL(/\/app\/equipamentos$/);
  await expect(detalhesEquipamento.getByLabel('Código')).toHaveValue('E2E-CHK-001');
  await expect(detalhesEquipamento.getByLabel('Nome')).toHaveValue('Equipamento Checklist E2E');
});
