import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const E2E_TECNICO = {
  email: 'e2e-tecnico@example.test',
  password: 'MaintenexE2E!123',
};

const E2E_EMPRESA_ID = '00000000-0000-4000-8000-000000000001';
const E2E_CIDADE_ID = '00000000-0000-4000-8000-000000000301';
const E2E_MATERIAL = {
  id: '00000000-0000-4000-8000-000000000304',
  codigo: 'E2E-EST-001',
  nome: 'Material Estoque E2E',
  unidade: 'un',
};
const MOTIVO_PREFIXO = 'E2E estoque repeatable';
const QUANTIDADE_ENTRADA = 2;

interface EstoqueInicial {
  id: string;
  quantidade: number;
  atualizado_em: string;
}

interface ClienteSupabaseE2E {
  url: string;
  anonKey: string;
  accessToken: string;
}

function lerEnvFrontend() {
  const envLocal = path.join(process.cwd(), 'frontend', '.env.local');
  const envExemplo = path.join(process.cwd(), 'frontend', '.env.example');
  const conteudo = readFileSync(envLocal, 'utf8') || readFileSync(envExemplo, 'utf8');

  return Object.fromEntries(
    conteudo
      .split(/\r?\n/)
      .map((linha) => linha.trim())
      .filter((linha) => linha && !linha.startsWith('#'))
      .map((linha) => {
        const indice = linha.indexOf('=');
        return [linha.slice(0, indice), linha.slice(indice + 1).replace(/^['"]|['"]$/g, '')];
      }),
  );
}

function valorSupabase(chave: 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY') {
  return process.env[chave] ?? lerEnvFrontend()[chave];
}

async function criarClienteSupabaseE2E(): Promise<ClienteSupabaseE2E> {
  const url = valorSupabase('VITE_SUPABASE_URL');
  const anonKey = valorSupabase('VITE_SUPABASE_ANON_KEY');
  if (!url || !anonKey) throw new Error('Supabase local não configurado para o E2E.');

  const resposta = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ email: E2E_TECNICO.email, password: E2E_TECNICO.password }),
  });

  if (!resposta.ok) throw new Error(`Falha ao autenticar usuário E2E: ${await resposta.text()}`);
  const sessao = await resposta.json() as { access_token?: string };
  if (!sessao.access_token) throw new Error('Autenticação E2E não retornou access_token.');

  return { url, anonKey, accessToken: sessao.access_token };
}

async function rest<T>(cliente: ClienteSupabaseE2E, caminho: string, init: RequestInit = {}) {
  const resposta = await fetch(`${cliente.url}/rest/v1/${caminho}`, {
    ...init,
    headers: {
      apikey: cliente.anonKey,
      authorization: `Bearer ${cliente.accessToken}`,
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

  if (!resposta.ok) throw new Error(`Falha REST ${caminho}: ${await resposta.text()}`);
  if (resposta.status === 204) return null as T;
  return await resposta.json() as T;
}

function filtrosEscopoE2E() {
  return [
    `empresa_id=eq.${E2E_EMPRESA_ID}`,
    `material_id=eq.${E2E_MATERIAL.id}`,
    `cidade_id=eq.${E2E_CIDADE_ID}`,
  ].join('&');
}

async function carregarEstoqueInicial(cliente: ClienteSupabaseE2E) {
  const [material] = await rest<Array<{ id: string; codigo: string; nome: string; unidade: string }>>(
    cliente,
    `materiais?select=id,codigo,nome,unidade&empresa_id=eq.${E2E_EMPRESA_ID}&codigo=eq.${E2E_MATERIAL.codigo}&limit=1`,
  );
  expect(material).toMatchObject(E2E_MATERIAL);

  const [cidade] = await rest<Array<{ id: string; empresa_id: string }>>(
    cliente,
    `cidades?select=id,empresa_id&id=eq.${E2E_CIDADE_ID}&empresa_id=eq.${E2E_EMPRESA_ID}&limit=1`,
  );
  expect(cidade).toMatchObject({ id: E2E_CIDADE_ID, empresa_id: E2E_EMPRESA_ID });

  const [estoqueInicial = null] = await rest<Array<EstoqueInicial>>(
    cliente,
    `estoque?select=id,quantidade,atualizado_em&${filtrosEscopoE2E()}&limit=1`,
  );

  return estoqueInicial;
}

async function buscarMovimentacaoCriada(cliente: ClienteSupabaseE2E, motivo: string) {
  const movimentacoes = await rest<Array<{ id: string; quantidade: number; tipo: string; motivo: string }>>(
    cliente,
    `movimentacoes?select=id,quantidade,tipo,motivo&${filtrosEscopoE2E()}&motivo=eq.${encodeURIComponent(motivo)}&limit=1`,
  );

  return movimentacoes[0] ?? null;
}

async function removerMovimentacaoCriada(cliente: ClienteSupabaseE2E, movimentacaoId: string, motivo: string) {
  await rest<null>(
    cliente,
    `movimentacoes?id=eq.${movimentacaoId}&${filtrosEscopoE2E()}&motivo=eq.${encodeURIComponent(motivo)}`,
    { method: 'DELETE' },
  );
}

async function restaurarEstoqueInicial(cliente: ClienteSupabaseE2E, estoqueInicial: EstoqueInicial | null) {
  if (estoqueInicial) {
    await rest<null>(
      cliente,
      `estoque?id=eq.${estoqueInicial.id}&${filtrosEscopoE2E()}`,
      {
        method: 'PATCH',
        headers: { prefer: 'return=minimal' },
        body: JSON.stringify({
          quantidade: estoqueInicial.quantidade,
          atualizado_em: estoqueInicial.atualizado_em,
        }),
      },
    );
    return;
  }

  await rest<null>(cliente, `estoque?${filtrosEscopoE2E()}`, { method: 'DELETE' });
}

test('técnico registra entrada de estoque E2E com isolamento', async ({ page }) => {
  const cliente = await criarClienteSupabaseE2E();
  const estoqueInicial = await carregarEstoqueInicial(cliente);
  const saldoInicial = estoqueInicial?.quantidade ?? 0;
  const saldoEsperado = saldoInicial + QUANTIDADE_ENTRADA;
  const motivo = `${MOTIVO_PREFIXO} ${randomUUID()}`;
  let movimentacaoCriadaId: string | null = null;

  await page.addInitScript((cidadeId) => {
    window.localStorage.setItem('maintenex.cidade', cidadeId);
  }, E2E_CIDADE_ID);

  try {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(E2E_TECNICO.email);
    await page.locator('input[type="password"]').fill(E2E_TECNICO.password);
    await page.locator('form').getByRole('button', { name: 'Entrar' }).click();

    await page.waitForURL('**/app', { timeout: 15_000 });
    await page.goto('/app/estoque');

    await expect(page).toHaveURL(/\/app\/estoque$/);
    await expect(page.getByRole('heading', { name: 'Estoque Geral' })).toBeVisible();

    await page.getByRole('button', { name: 'Movimentar' }).click();

    const modalMovimentacao = page.getByRole('dialog', { name: 'Registrar movimentação' });
    await expect(modalMovimentacao).toBeVisible();

    const campoMaterial = modalMovimentacao.getByLabel('Material');
    await expect(campoMaterial).toBeVisible();

    await expect
      .poll(
        async () =>
          campoMaterial.locator('option').evaluateAll(
            (opcoes) => opcoes.filter((opcao) => (opcao as HTMLOptionElement).value).length,
          ),
        { timeout: 15_000 },
      )
      .toBeGreaterThan(0);

    await campoMaterial.selectOption(E2E_MATERIAL.id);
    await expect(campoMaterial).toHaveValue(E2E_MATERIAL.id);

    const campoTipo = modalMovimentacao.getByLabel('Tipo');
    await expect(campoTipo).toBeVisible();
    await campoTipo.selectOption('entrada');
    await expect(campoTipo).toHaveValue('entrada');

    const campoQuantidade = modalMovimentacao.getByLabel('Quantidade');
    await expect(campoQuantidade).toBeVisible();
    await campoQuantidade.fill(String(QUANTIDADE_ENTRADA));
    await expect(campoQuantidade).toHaveValue(String(QUANTIDADE_ENTRADA));

    const campoMotivo = modalMovimentacao.getByLabel('Motivo');
    await campoMotivo.fill(motivo);
    await expect(campoMotivo).toHaveValue(motivo);

    await modalMovimentacao.getByRole('button', { name: 'Registrar' }).click();

    await expect(page.getByText('Movimentação registrada — saldo atualizado.')).toBeVisible();
    await expect(modalMovimentacao).not.toBeVisible();

    const saldoFormatado = new Intl.NumberFormat('pt-BR').format(saldoEsperado);
    const linhaMaterialE2E = page.getByRole('row', { name: /E2E-EST-001/ });
    await expect(linhaMaterialE2E).toContainText(`${saldoFormatado} un`);

    await expect(page.getByText(E2E_MATERIAL.nome).first()).toBeVisible();
    await expect(page.getByText(`+${QUANTIDADE_ENTRADA} un · ${motivo}`)).toBeVisible();

    const movimentacaoCriada = await buscarMovimentacaoCriada(cliente, motivo);
    expect(movimentacaoCriada).toMatchObject({
      quantidade: QUANTIDADE_ENTRADA,
      tipo: 'entrada',
      motivo,
    });
    movimentacaoCriadaId = movimentacaoCriada!.id;
  } finally {
    const movimentacaoCriada = movimentacaoCriadaId
      ? { id: movimentacaoCriadaId }
      : await buscarMovimentacaoCriada(cliente, motivo);

    if (movimentacaoCriada?.id) {
      await removerMovimentacaoCriada(cliente, movimentacaoCriada.id, motivo);
    }
    await restaurarEstoqueInicial(cliente, estoqueInicial);
  }
});
