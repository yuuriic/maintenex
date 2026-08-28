import { expect, test, type Page } from '@playwright/test';

const E2E_TECNICO = {
  email: 'e2e-tecnico@example.test',
  password: 'MaintenexE2E!123',
};

const E2E_TENANT_ID = '00000000-0000-4000-8000-000000000001';
const E2E_CIDADE_ID = '00000000-0000-4000-8000-000000000301';
const E2E_EQUIPAMENTO_ID = '00000000-0000-4000-8000-000000000303';
const TITULO_PENDENCIA_E2E_PREFIXO = 'Pendência obrigatória E2E isolada';

function tituloPendenciaE2E(workerIndex: number) {
  return `${TITULO_PENDENCIA_E2E_PREFIXO} worker-${workerIndex} ${Date.now()}`;
}

async function obterPendenciaCriada(page: Page, titulo: string, criadaDepoisDe: string) {
  return page.evaluate(
    async ({ empresaId, cidadeId, equipamentoId, tituloPendencia, criadaDepoisDeIso }) => {
      const { supabase } = await import('/src/lib/supabase.ts');
      const { data, error } = await supabase
        .from('pendencias')
        .select('id')
        .eq('empresa_id', empresaId)
        .eq('cidade_id', cidadeId)
        .eq('equipamento_id', equipamentoId)
        .eq('titulo', tituloPendencia)
        .eq('prioridade', 'media')
        .eq('status', 'aberta')
        .gte('aberta_em', criadaDepoisDeIso)
        .order('aberta_em', { ascending: false });

      if (error) throw new Error(`Não foi possível localizar a pendência E2E criada: ${error.message}`);
      if (!data || data.length !== 1) {
        throw new Error(`Cleanup inseguro: esperado exatamente 1 pendência E2E criada, encontrado ${data?.length ?? 0}.`);
      }

      return data[0].id as string;
    },
    {
      empresaId: E2E_TENANT_ID,
      cidadeId: E2E_CIDADE_ID,
      equipamentoId: E2E_EQUIPAMENTO_ID,
      tituloPendencia: titulo,
      criadaDepoisDeIso: criadaDepoisDe,
    },
  );
}

async function removerPendenciaCriada(page: Page, id: string, titulo: string) {
  await page.evaluate(
    async ({ empresaId, cidadeId, equipamentoId, pendenciaId, tituloPendencia }) => {
      const { supabase } = await import('/src/lib/supabase.ts');
      const { data, error } = await supabase
        .from('pendencias')
        .delete()
        .eq('id', pendenciaId)
        .eq('empresa_id', empresaId)
        .eq('cidade_id', cidadeId)
        .eq('equipamento_id', equipamentoId)
        .eq('titulo', tituloPendencia)
        .select('id');

      if (error) throw new Error(`Não foi possível remover a pendência E2E criada: ${error.message}`);
      if (!data || data.length !== 1 || data[0].id !== pendenciaId) {
        throw new Error(`Cleanup inseguro: esperado remover exatamente a pendência ${pendenciaId}, removidas ${data?.length ?? 0}.`);
      }
    },
    {
      empresaId: E2E_TENANT_ID,
      cidadeId: E2E_CIDADE_ID,
      equipamentoId: E2E_EQUIPAMENTO_ID,
      pendenciaId: id,
      tituloPendencia: titulo,
    },
  );
}

test('técnico acessa a página de Pendências', async ({ page }, testInfo) => {
  const tituloPendencia = tituloPendenciaE2E(testInfo.workerIndex);
  let pendenciaCriadaId: string | null = null;

  try {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(E2E_TECNICO.email);
    await page.locator('input[type="password"]').fill(E2E_TECNICO.password);
    await page.locator('form').getByRole('button', { name: 'Entrar' }).click();

    await page.waitForURL('**/app', { timeout: 15_000 });
    await page.getByRole('link', { name: /pendências/i }).click();

    await expect(page).toHaveURL(/\/app\/pendencias$/);
    await expect(page.getByRole('heading', { name: 'Pendências' })).toBeVisible();

    const criarPendenciaAction = page.getByRole('button', { name: /nova pendência/i });
    await expect(criarPendenciaAction).toBeVisible();
    await criarPendenciaAction.click();

    const creationModal = page.getByRole('dialog', { name: /nova pendência/i });
    await expect(creationModal).toBeVisible();

    const titleField = creationModal.getByLabel('Título');
    await expect(titleField).toBeVisible();
    await titleField.fill(tituloPendencia);
    await expect(titleField).toHaveValue(tituloPendencia);

    const priorityField = creationModal.getByLabel('Prioridade');
    await expect(priorityField).toHaveValue('media');

    const equipmentField = creationModal.getByLabel('Equipamento');
    await expect(equipmentField).toBeVisible();
    await expect(equipmentField.locator(`option[value="${E2E_EQUIPAMENTO_ID}"]`)).toHaveCount(1, { timeout: 15_000 });
    await equipmentField.selectOption(E2E_EQUIPAMENTO_ID);
    await expect(equipmentField).toHaveValue(E2E_EQUIPAMENTO_ID);

    await expect(creationModal.getByLabel('Descrição')).toBeVisible();

    const criadaDepoisDe = new Date(Date.now() - 10_000).toISOString();
    await creationModal.getByRole('button', { name: /abrir pendência/i }).click();

    await expect(page.getByRole('status')).toContainText('Pendência aberta.');
    await expect(creationModal).toBeHidden();
    await expect(page.getByText(tituloPendencia).first()).toBeVisible({ timeout: 15_000 });

    pendenciaCriadaId = await obterPendenciaCriada(page, tituloPendencia, criadaDepoisDe);
  } finally {
    if (pendenciaCriadaId) {
      await removerPendenciaCriada(page, pendenciaCriadaId, tituloPendencia);
    }
  }
});
