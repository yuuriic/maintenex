import { expect, test, type Page } from '@playwright/test';

const E2E_USER = {
  email: 'e2e-owner@example.test',
  password: 'MaintenexE2E!123',
  name: 'E2E Owner',
  role: 'owner',
};

async function expectLoginForm(page: Page) {
  await expect(page.getByRole('heading', { name: 'Bem-vindo de volta' })).toBeVisible();
  await expect(page.getByLabel('E-mail')).toBeVisible();
  await expect(page.locator('input[type="password"]')).toBeVisible();
}

async function login(page: Page, email = E2E_USER.email, password = E2E_USER.password) {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('form').getByRole('button', { name: 'Entrar' }).click();
}

async function expectAuthenticatedApp(page: Page) {
  await page.waitForURL('**/app', { timeout: 15_000 });
  await expect(page.locator('.shell')).toBeVisible();
  await expect(page.locator('.perfil-texto')).toContainText(E2E_USER.name);
  await expect(page.locator('.perfil-texto')).toContainText(E2E_USER.role);
}

test.describe('autenticação', () => {
  test('login válido', async ({ page }) => {
    await login(page);

    await expectAuthenticatedApp(page);
  });

  test('login inválido', async ({ page }) => {
    await login(page, E2E_USER.email, 'senha-incorreta');

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByText('E-mail ou senha incorretos.')).toBeVisible();
    await expect(page.locator('.shell')).not.toBeVisible();
  });

  test('acesso a /app sem sessão', async ({ page }) => {
    await page.goto('/app');

    await expect(page).toHaveURL(/\/login$/);
    await expectLoginForm(page);
    await expect(page.locator('.shell')).not.toBeVisible();
  });

  test('persistência após page.reload()', async ({ page }) => {
    await login(page);
    await expectAuthenticatedApp(page);

    await page.reload();

    await expectAuthenticatedApp(page);
  });

  test('logout e tentativa de voltar', async ({ page }) => {
    await login(page);
    await expectAuthenticatedApp(page);

    await page.getByRole('button', { name: 'Sair' }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expectLoginForm(page);

    await page.goBack();

    expect(page.url()).not.toContain('/app');
    await expect(page.locator('.shell')).not.toBeVisible();
    if (page.url() !== 'about:blank') {
      await expect(page).toHaveURL(/\/login$/);
      await expectLoginForm(page);
    }
  });
});
