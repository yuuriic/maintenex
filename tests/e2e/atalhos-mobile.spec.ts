import { expect, test, type Page } from '@playwright/test';
import { abrirApp, prepararSupabaseMock, rotulosBottomNav } from './helpers/supabase-mock';

/**
 * Personalização dos atalhos da bottom navigation mobile.
 * Roda contra o mock Supabase (helpers/supabase-mock.ts): sem banco, sem contas reais.
 */

const PADRAO = ['Dashboard', 'Checklist', 'Equipamentos', 'Pendências', 'Mais'];

async function abrirPersonalizar(page: Page) {
  await page.locator('.bottom-nav button', { hasText: 'Mais' }).click();
  await page.getByRole('button', { name: 'Personalizar atalhos' }).click();
  await expect(page.getByRole('dialog', { name: 'Personalizar atalhos' })).toBeVisible();
}

function itemModulo(page: Page, nome: string) {
  return page.locator('.atalhos-item').filter({ has: page.locator('.atalhos-nome', { hasText: new RegExp(`^${nome}$`) }) });
}

test.describe('bottom navigation mobile — atalhos personalizados', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('1. usuário sem preferência recebe os atalhos padrão por prioridade', async ({ page }) => {
    await prepararSupabaseMock(page, { papel: 'owner', atalhosMobile: null });
    await abrirApp(page);
    expect(await rotulosBottomNav(page)).toEqual(PADRAO);
  });

  test('2. usuário com preferência vê a ordem personalizada', async ({ page }) => {
    await prepararSupabaseMock(page, { papel: 'owner', atalhosMobile: ['dashboard', 'estoque', 'relatorios', 'checklist'] });
    await abrirApp(page);
    expect(await rotulosBottomNav(page)).toEqual(['Dashboard', 'Estoque Geral', 'Relatórios', 'Checklist', 'Mais']);
  });

  test('3/7. ids sem permissão ou desconhecidos são descartados (owner não recebe Empresas)', async ({ page }) => {
    await prepararSupabaseMock(page, { papel: 'owner', atalhosMobile: ['empresas', 'inexistente', 'relatorios', 'dashboard'] });
    await abrirApp(page);
    expect(await rotulosBottomNav(page)).toEqual(['Relatórios', 'Dashboard', 'Mais']);
    // e o "Mais" não ganha Empresas por causa do id salvo
    await page.locator('.bottom-nav button', { hasText: 'Mais' }).click();
    await expect(page.getByRole('dialog', { name: 'Mais opções' })).toBeVisible();
    await expect(page.locator('.sheet-nav .sheet-item span')).toHaveText(['Checklist', 'Equipamentos', 'Estoque Geral', 'Pendências', 'Configurações']);
  });

  test('4. com quatro selecionados, um quinto é bloqueado e desmarcar continua possível', async ({ page }) => {
    await prepararSupabaseMock(page, { papel: 'owner', atalhosMobile: null });
    await abrirApp(page);
    await abrirPersonalizar(page);
    const contador = page.locator('.atalhos-contador');
    await expect(contador).toHaveText('4 de 4 selecionados · limite atingido');
    const estoque = itemModulo(page, 'Estoque Geral');
    await expect(estoque).toHaveAttribute('aria-disabled', 'true');
    await estoque.click({ force: true }); // o item fica aria-disabled; o clique forçado prova que nada muda
    await expect(estoque).toHaveAttribute('aria-pressed', 'false');
    await expect(contador).toHaveText('4 de 4 selecionados · limite atingido');
    // desmarcar libera a vaga
    await itemModulo(page, 'Pendências').click();
    await expect(contador).toHaveText('3 de 4 selecionados');
    await expect(estoque).toHaveAttribute('aria-disabled', 'false');
    await estoque.click();
    await expect(estoque).toHaveAttribute('aria-pressed', 'true');
    await expect(contador).toHaveText('4 de 4 selecionados · limite atingido');
  });

  test('5. salvar persiste só ids e a configuração sobrevive ao reload', async ({ page }) => {
    const estado = await prepararSupabaseMock(page, { papel: 'owner', atalhosMobile: null });
    await abrirApp(page);
    await abrirPersonalizar(page);
    await itemModulo(page, 'Pendências').click(); // desmarca
    await itemModulo(page, 'Relatórios').click(); // marca (fica em 4º)
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.locator('.toast.sucesso')).toContainText('Atalhos atualizados.');
    await expect(page.getByRole('dialog', { name: 'Personalizar atalhos' })).toHaveCount(0);
    expect(estado.gravacoes).toEqual([{ atalhos_mobile: ['dashboard', 'checklist', 'equipamentos', 'relatorios'] }]);
    expect(await rotulosBottomNav(page)).toEqual(['Dashboard', 'Checklist', 'Equipamentos', 'Relatórios', 'Mais']);

    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('.content section');
    expect(await rotulosBottomNav(page)).toEqual(['Dashboard', 'Checklist', 'Equipamentos', 'Relatórios', 'Mais']);
  });

  test('6. logout e novo login mantêm a configuração da conta', async ({ page }) => {
    await prepararSupabaseMock(page, { papel: 'owner', atalhosMobile: ['estoque', 'dashboard'] });
    await abrirApp(page);
    expect(await rotulosBottomNav(page)).toEqual(['Estoque Geral', 'Dashboard', 'Mais']);
    await page.locator('.bottom-nav button', { hasText: 'Mais' }).click();
    await page.getByRole('button', { name: 'Sair' }).click();
    await page.waitForURL(/\/login$/);
    // nova sessão da mesma conta (a preferência mora no perfil, não neste navegador)
    await page.evaluate(() => localStorage.removeItem('maintenex.cidade'));
    await abrirApp(page);
    expect(await rotulosBottomNav(page)).toEqual(['Estoque Geral', 'Dashboard', 'Mais']);
  });

  test('8. super_admin pode fixar Empresas na barra', async ({ page }) => {
    const estado = await prepararSupabaseMock(page, { papel: 'super_admin', atalhosMobile: null });
    await abrirApp(page);
    await abrirPersonalizar(page);
    await itemModulo(page, 'Dashboard').click(); // libera uma vaga
    const empresas = itemModulo(page, 'Empresas');
    await expect(empresas).toBeVisible();
    await empresas.click();
    await expect(empresas).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.locator('.toast.sucesso')).toBeVisible();
    expect(estado.gravacoes).toEqual([{ atalhos_mobile: ['checklist', 'equipamentos', 'pendencias', 'empresas'] }]);
    expect(await rotulosBottomNav(page)).toEqual(['Checklist', 'Equipamentos', 'Pendências', 'Empresas', 'Mais']);
  });

  test('9. o menu "Mais" lista exatamente os módulos fora da barra, na ordem da sidebar', async ({ page }) => {
    await prepararSupabaseMock(page, { papel: 'owner', atalhosMobile: ['dashboard', 'estoque', 'relatorios', 'checklist'] });
    await abrirApp(page);
    await page.locator('.bottom-nav button', { hasText: 'Mais' }).click();
    await expect(page.locator('.sheet-nav .sheet-item span')).toHaveText(['Equipamentos', 'Pendências', 'Configurações']);
  });

  test('10. rota que está dentro de "Mais" deixa o botão "Mais" ativo', async ({ page }) => {
    await prepararSupabaseMock(page, { papel: 'owner', atalhosMobile: ['dashboard', 'estoque', 'relatorios', 'checklist'] });
    await abrirApp(page, '/app/pendencias');
    await expect(page.locator('.bottom-nav button', { hasText: 'Mais' })).toHaveClass(/active/);
    await expect(page.locator('.bottom-nav a.active')).toHaveCount(0);
  });

  test('erro ao salvar mantém a configuração anterior e permite tentar de novo', async ({ page }) => {
    await prepararSupabaseMock(page, { papel: 'owner', atalhosMobile: ['dashboard', 'estoque'], falharAoSalvar: true });
    await abrirApp(page);
    await abrirPersonalizar(page);
    await itemModulo(page, 'Relatórios').click();
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.locator('.toast.erro')).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Personalizar atalhos' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Salvar' })).toBeEnabled();
    expect(await rotulosBottomNav(page)).toEqual(['Dashboard', 'Estoque Geral', 'Mais']);
  });

  test('restaurar padrão grava NULL e volta à prioridade', async ({ page }) => {
    const estado = await prepararSupabaseMock(page, { papel: 'owner', atalhosMobile: ['relatorios'] });
    await abrirApp(page);
    await abrirPersonalizar(page);
    await page.getByRole('button', { name: 'Restaurar padrão' }).click();
    await expect(page.locator('.toast.sucesso')).toContainText('padrão');
    expect(estado.gravacoes).toEqual([{ atalhos_mobile: null }]);
    expect(await rotulosBottomNav(page)).toEqual(PADRAO);
  });

  test('ordenação com as setas reflete na prévia e no array salvo', async ({ page }) => {
    const estado = await prepararSupabaseMock(page, { papel: 'owner', atalhosMobile: null });
    await abrirApp(page);
    await abrirPersonalizar(page);
    await page.getByRole('button', { name: 'Mover Pendências para a esquerda' }).click();
    await expect(page.locator('.atalhos-previa small')).toHaveText(['Dashboard', 'Checklist', 'Pendências', 'Equipamentos', 'Mais']);
    await expect(page.getByRole('button', { name: 'Mover Dashboard para a esquerda' })).toBeDisabled();
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.locator('.toast.sucesso')).toBeVisible();
    expect(estado.gravacoes).toEqual([{ atalhos_mobile: ['dashboard', 'checklist', 'pendencias', 'equipamentos'] }]);
  });
});

test.describe('bottom navigation mobile — 320px', () => {
  test.use({ viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true });

  test('12. tela de personalização sem scroll horizontal em 320px', async ({ page }) => {
    await prepararSupabaseMock(page, { papel: 'super_admin', atalhosMobile: null });
    await abrirApp(page);
    await abrirPersonalizar(page);
    const medidas = await page.evaluate(() => {
      const vw = window.innerWidth;
      const fora = [...document.querySelectorAll('.sheet-atalhos *')].filter((el) => { const r = el.getBoundingClientRect(); return r.width && (r.right > vw + 1 || r.left < -1); }).length;
      const sheet = document.querySelector('.sheet-atalhos') as HTMLElement;
      return { docScrollW: document.documentElement.scrollWidth, vw, fora, sheetScrollW: sheet.scrollWidth, sheetClientW: sheet.clientWidth };
    });
    expect(medidas.docScrollW).toBeLessThanOrEqual(medidas.vw);
    expect(medidas.fora).toBe(0);
    expect(medidas.sheetScrollW).toBeLessThanOrEqual(medidas.sheetClientW + 1);
  });
});

test.describe('desktop permanece com a navegação original', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('11. preferência mobile não reorganiza a sidebar nem cria bottom nav', async ({ page }) => {
    await prepararSupabaseMock(page, { papel: 'owner', atalhosMobile: ['relatorios', 'estoque', 'dashboard', 'checklist'] });
    await abrirApp(page);
    await expect(page.locator('.bottom-nav')).toHaveCount(0);
    await expect(page.locator('.shell > aside nav a .nav-rotulo')).toHaveText(['Dashboard', 'Checklist', 'Equipamentos', 'Estoque Geral', 'Pendências', 'Relatórios', 'Configurações']);
    await expect(page.getByRole('button', { name: 'Personalizar atalhos' })).toHaveCount(0);
  });
});
