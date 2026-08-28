import { expect, test, type Page } from '@playwright/test';

const E2E_TECNICO = {
  email: 'e2e-tecnico@example.test',
  password: 'MaintenexE2E!123',
};

const CHECKLIST_OBRIGATORIO_E2E = {
  tituloPrefixo: 'Checklist obrigatório E2E',
  tecnico: 'Técnico Checklist E2E',
};

const E2E_TENANT_ID = '00000000-0000-4000-8000-000000000001';
const E2E_EQUIPAMENTO_ID = '00000000-0000-4000-8000-000000000303';

function tituloChecklistE2E(workerIndex: number) {
  return `${CHECKLIST_OBRIGATORIO_E2E.tituloPrefixo} worker-${workerIndex}`;
}

async function obterChecklistCriado(page: Page, titulo: string, criadoDepoisDe: string) {
  return page.evaluate(
    async ({ empresaId, equipamentoId, tituloChecklist, criadoDepoisDeIso }) => {
      const { supabase } = await import('/src/lib/supabase.ts');
      const { data, error } = await supabase
        .from('checklists')
        .select('id')
        .eq('empresa_id', empresaId)
        .eq('equipamento_id', equipamentoId)
        .eq('titulo', tituloChecklist)
        .gte('criado_em', criadoDepoisDeIso)
        .order('criado_em', { ascending: false });

      if (error) throw new Error(`Não foi possível localizar o checklist E2E criado: ${error.message}`);
      if (!data || data.length !== 1) {
        throw new Error(`Cleanup inseguro: esperado exatamente 1 checklist E2E criado, encontrado ${data?.length ?? 0}.`);
      }

      return data[0].id as string;
    },
    {
      empresaId: E2E_TENANT_ID,
      equipamentoId: E2E_EQUIPAMENTO_ID,
      tituloChecklist: titulo,
      criadoDepoisDeIso: criadoDepoisDe,
    },
  );
}

async function removerChecklistCriado(page: Page, id: string, titulo: string) {
  await page.evaluate(
    async ({ empresaId, equipamentoId, checklistId, tituloChecklist }) => {
      const { supabase } = await import('/src/lib/supabase.ts');
      const { data, error } = await supabase
        .from('checklists')
        .delete()
        .eq('id', checklistId)
        .eq('empresa_id', empresaId)
        .eq('equipamento_id', equipamentoId)
        .eq('titulo', tituloChecklist)
        .select('id');

      if (error) throw new Error(`Não foi possível remover o checklist E2E criado: ${error.message}`);
      if (!data || data.length !== 1 || data[0].id !== checklistId) {
        throw new Error(`Cleanup inseguro: esperado remover exatamente o checklist ${checklistId}, removidos ${data?.length ?? 0}.`);
      }
    },
    {
      empresaId: E2E_TENANT_ID,
      equipamentoId: E2E_EQUIPAMENTO_ID,
      checklistId: id,
      tituloChecklist: titulo,
    },
  );
}

test('técnico acessa a página de Checklist', async ({ page }, testInfo) => {
  const checklistTitulo = tituloChecklistE2E(testInfo.workerIndex);

  await page.goto('/login');
  await page.getByLabel('E-mail').fill(E2E_TECNICO.email);
  await page.locator('input[type="password"]').fill(E2E_TECNICO.password);
  await page.locator('form').getByRole('button', { name: 'Entrar' }).click();

  await page.waitForURL('**/app', { timeout: 15_000 });
  await page.getByRole('link', { name: /checklist/i }).click();

  await expect(page).toHaveURL(/\/app\/checklist$/);
  await expect(page.getByRole('heading', { name: /checklist/i })).toBeVisible();

  const createChecklistAction = page
    .getByRole('button', { name: /novo checklist|criar checklist/i })
    .or(page.getByRole('link', { name: /novo checklist|criar checklist/i }))
    .first();

  await expect(createChecklistAction).toBeVisible();
  await createChecklistAction.click();

  const creationForm = page
    .getByRole('dialog', { name: /novo checklist|criar checklist/i })
    .or(page.getByRole('form', { name: /novo checklist|criar checklist/i }))
    .first();

  await expect(creationForm).toBeVisible();

  const equipmentField = creationForm.getByRole('combobox', { name: /^Equipamento$/ });
  await expect(equipmentField).toBeVisible();

  const e2eEquipmentOption = equipmentField.locator(`option[value="${E2E_EQUIPAMENTO_ID}"]`);

  await expect(e2eEquipmentOption, 'aguardar equipamento E2E disponível no campo Equipamento').toHaveCount(1, {
    timeout: 15_000,
  });

  const equipmentLabel = (await e2eEquipmentOption.textContent())?.trim() ?? '';

  const [equipmentCode, equipmentName] = equipmentLabel.split('—').map((part) => part.trim());
  expect(equipmentCode).toBeTruthy();
  expect(equipmentName).toBeTruthy();

  await equipmentField.selectOption(E2E_EQUIPAMENTO_ID);

  const equipmentSummary = creationForm.locator('.equipamento-resumo');
  await expect(equipmentField).toHaveValue(E2E_EQUIPAMENTO_ID);
  await expect(equipmentSummary).toBeVisible();
  await expect(equipmentSummary).toContainText(equipmentCode);
  await expect(equipmentSummary).toContainText(equipmentName);

  const titleField = creationForm.getByLabel('Título do checklist');
  const technicianField = creationForm.getByLabel('Técnico responsável');

  await titleField.fill(checklistTitulo);
  await technicianField.fill(CHECKLIST_OBRIGATORIO_E2E.tecnico);

  await expect(titleField).toHaveValue(checklistTitulo);
  await expect(technicianField).toHaveValue(CHECKLIST_OBRIGATORIO_E2E.tecnico);

  const submitChecklistAction = creationForm.getByRole('button', { name: 'Criar checklist' });
  await expect(submitChecklistAction).toBeVisible();

  const criadoDepoisDe = new Date(Date.now() - 10_000).toISOString();
  await submitChecklistAction.click();

  await expect(creationForm).toBeHidden({ timeout: 15_000 });
  await expect(page.getByText('Checklist criado com o modelo selecionado.')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(checklistTitulo).first()).toBeVisible({ timeout: 15_000 });

  const checklistCriadoId = await obterChecklistCriado(page, checklistTitulo, criadoDepoisDe);
  await removerChecklistCriado(page, checklistCriadoId, checklistTitulo);
});
