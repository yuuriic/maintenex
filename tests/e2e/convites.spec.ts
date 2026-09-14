import { expect, test, type Page } from '@playwright/test';

const EMPRESA_ID = '00000000-0000-4000-8000-000000000001';
const OWNER_ID = '00000000-0000-4000-8000-000000000101';

const conviteFalho = {
  id: 'convite-e2e-falhou',
  empresa_id: EMPRESA_ID,
  email: 'falha-convite-e2e@example.test',
  papel: 'tecnico',
  criado_por: OWNER_ID,
  aceito_em: null,
  expira_em: '2026-12-31T00:00:00Z',
  criado_em: '2026-01-01T00:00:00Z',
  token_hash: null,
  status_envio: 'falhou',
  tentativas_envio: 1,
  enviado_em: null,
  reenviado_em: null,
  ultimo_erro_envio: 'Falha no envio.',
  ultimo_id_envio: null,
  atualizado_em: '2026-01-01T00:00:00Z',
};

type ChamadaConvite = { action?: string };

async function mockOwnerSession(page: Page, options: {
  convites?: unknown[];
  inviteResponse?: Record<string, unknown>;
  inviteStatus?: number;
  onInvite?: (body: Record<string, unknown>) => void;
  chamadas?: ChamadaConvite[];
  profile?: Record<string, unknown>;
  signup?: boolean;
} = {}) {
  if (options.signup) {
    await page.route('**/auth/v1/signup', async (route) => {
      const body = route.request().postDataJSON() as { email?: string; data?: Record<string, unknown> };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'token-convidado-e2e',
          refresh_token: 'refresh-convidado-e2e',
          token_type: 'bearer',
          expires_in: 3600,
          user: { id: OWNER_ID, email: body.email, user_metadata: body.data ?? {} },
        }),
      });
    });
  }

  await page.route('**/auth/v1/token?grant_type=password', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: 'token-owner-e2e',
        refresh_token: 'refresh-owner-e2e',
        token_type: 'bearer',
        expires_in: 3600,
        user: { id: OWNER_ID, email: 'e2e-owner@example.test', user_metadata: { nome: 'E2E Owner' } },
      }),
    });
  });

  await page.route('**/rest/v1/profiles**', async (route) => {
    if (route.request().url().includes('empresa_id=eq.')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(options.profile ?? {
        id: OWNER_ID,
        empresa_id: EMPRESA_ID,
        nome: 'E2E Owner',
        email: 'e2e-owner@example.test',
        telefone: null,
        email_verificado: true,
        papel: 'owner',
        cidade_id: null,
        avatar_url: null,
        ativo: true,
        criado_em: '2026-01-01T00:00:00Z',
        empresas: { id: EMPRESA_ID, nome: 'Maintenex E2E Local', slug: 'maintenex-e2e-local', status: 'ativa' },
      }),
    });
  });

  await page.route('**/rest/v1/cidades?select=*%2C+empresas*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  await page.route('**/rest/v1/setores?select=**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  await page.route('**/rest/v1/empresas?select=*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: EMPRESA_ID,
        nome: 'Maintenex E2E Local',
        slug: 'maintenex-e2e-local',
        cnpj: null,
        email_principal: 'e2e-owner@example.test',
        telefone: null,
        status: 'ativa',
        criado_por: OWNER_ID,
        criado_em: '2026-01-01T00:00:00Z',
      }),
    });
  });
  await page.route('**/rest/v1/convites?select=*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(options.convites ?? []) });
  });
  await page.route('**/rest/v1/dashboard_configuracoes?select=layout*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: 'null' });
  });
  await page.route('**/functions/v1/team-invites', async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    options.chamadas?.push({ action: body.action as string | undefined });
    options.onInvite?.(body);
    await route.fulfill({
      status: options.inviteStatus ?? 200,
      contentType: 'application/json',
      body: JSON.stringify(options.inviteResponse ?? {
        status: 'dry_run',
        mensagem: 'Convite gerado em modo teste. Nenhum e-mail real foi enviado.',
        conviteId: 'convite-e2e-dry-run',
        inviteUrl: 'http://127.0.0.1:5173/login?modo=cadastrar&convite=token-e2e',
      }),
    });
  });
}

async function loginComoOwner(page: Page) {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill('e2e-owner@example.test');
  await page.locator('input[type="password"]').fill('MaintenexE2E!123');
  await page.locator('form').getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL('**/app', { timeout: 15_000 });
  await page.goto('/app/configuracoes');
  await page.getByRole('tab', { name: 'Equipe' }).click();
}

test('formulário envia convite em modo teste pela Edge Function', async ({ page }) => {
  await mockOwnerSession(page, {
    onInvite: (body) => expect(body).toMatchObject({ action: 'send', papel: 'tecnico', email: 'novo-convidado-e2e@example.test' }),
  });

  await loginComoOwner(page);
  await page.getByLabel('E-mail').fill('novo-convidado-e2e@example.test');
  await page.getByRole('button', { name: 'Enviar convite' }).click();

  await expect(page.getByText('Convite gerado em modo teste. Nenhum e-mail real foi enviado.')).toBeVisible();
});

test('falha de envio retorna feedback e não trava o formulário', async ({ page }) => {
  await mockOwnerSession(page, {
    inviteResponse: {
      status: 'falhou',
      mensagem: 'Convite registrado, mas não foi possível enviar o e-mail.',
      conviteId: 'convite-e2e-falhou',
    },
  });

  await loginComoOwner(page);
  await page.getByLabel('E-mail').fill('falha-convite-e2e@example.test');
  await page.getByRole('button', { name: 'Enviar convite' }).click();

  await expect(page.getByText('Convite registrado, mas não foi possível enviar o e-mail.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enviar convite' })).toBeEnabled();
});

test('reenvio usa a Edge Function e exibe status de envio', async ({ page }) => {
  await mockOwnerSession(page, {
    convites: [conviteFalho],
    onInvite: (body) => expect(body).toMatchObject({ action: 'resend', conviteId: conviteFalho.id }),
  });

  await loginComoOwner(page);
  await expect(page.getByText('Falha no envio', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Reenviar' }).click();

  await expect(page.getByText('Convite gerado em modo teste. Nenhum e-mail real foi enviado.')).toBeVisible();
});

test('usuário já membro retorna aviso sem criar convite duplicado', async ({ page }) => {
  await mockOwnerSession(page, {
    inviteResponse: {
      status: 'ja_membro',
      mensagem: 'Este usuário já faz parte da equipe.',
    },
  });

  await loginComoOwner(page);
  await page.getByLabel('E-mail').fill('e2e-tecnico@example.test');
  await page.getByRole('button', { name: 'Enviar convite' }).click();

  await expect(page.getByText('Este usuário já faz parte da equipe.')).toBeVisible();
});

test('link seguro de convite pede e-mail convidado e bloqueia empresa', async ({ page }) => {
  await page.goto('/login?modo=cadastrar&convite=token-e2e');

  await expect(page.getByRole('heading', { name: 'Crie sua conta' })).toBeVisible();
  await expect(page.getByText('Você recebeu um convite individual.')).toBeVisible();
  await expect(page.getByLabel('E-mail')).toHaveValue('');
  await expect(page.getByLabel('E-mail')).toBeEditable();
  await expect(page.getByLabel('Empresa')).toHaveCount(0);
});

async function preencherCadastroConvidado(page: Page, email: string) {
  await page.getByLabel('Nome').fill('Convidado E2E');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Telefone').fill('11999990000');
  await page.locator('#senha-cadastro').fill('MaintenexE2E!123');
  await page.getByLabel('Confirmar senha').fill('MaintenexE2E!123');
  await page.locator('form').getByRole('button', { name: 'Criar conta' }).click();
}

test('cadastro por convite entra no app sem chamar accept e sem erro', async ({ page }) => {
  const chamadas: ChamadaConvite[] = [];
  await mockOwnerSession(page, { signup: true, chamadas });

  await page.goto('/login?modo=cadastrar&convite=token-e2e');
  await expect(page.getByLabel('Empresa')).toHaveCount(0);
  await preencherCadastroConvidado(page, 'convidado-e2e@example.test');

  await page.waitForURL('**/app', { timeout: 15_000 });
  await expect(page.getByText('Não foi possível aceitar o convite')).toHaveCount(0);
  expect(chamadas.filter((c) => c.action === 'accept')).toHaveLength(0);
});

test('cadastro por convite com perfil sem empresa usa o aceite explícito uma única vez', async ({ page }) => {
  const chamadas: ChamadaConvite[] = [];
  await mockOwnerSession(page, {
    signup: true,
    chamadas,
    inviteResponse: { status: 'aceito', mensagem: 'Convite aceito. Você já pode acessar a equipe.' },
    profile: {
      id: OWNER_ID, empresa_id: null, nome: 'Convidado E2E', email: 'orfao-e2e@example.test', telefone: null,
      email_verificado: true, papel: 'leitor', cidade_id: null, avatar_url: null, ativo: true,
      criado_em: '2026-01-01T00:00:00Z', empresas: null,
    },
  });

  await page.goto('/login?modo=cadastrar&convite=token-e2e');
  await preencherCadastroConvidado(page, 'orfao-e2e@example.test');

  await page.waitForURL('**/app', { timeout: 15_000 });
  expect(chamadas.filter((c) => c.action === 'accept')).toHaveLength(1);
});

test('usuário já logado não aceita convite automaticamente', async ({ page }) => {
  const chamadas: ChamadaConvite[] = [];
  await mockOwnerSession(page, { chamadas });
  await loginComoOwner(page);

  await page.goto('/login?modo=cadastrar&convite=token-e2e');
  await expect(page.getByRole('heading', { name: 'Você recebeu um convite de equipe' })).toBeVisible();
  await expect(page.getByText('e2e-owner@example.test')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Aceitar com esta conta' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sair e usar o e-mail convidado' })).toBeVisible();
  expect(chamadas.filter((c) => c.action === 'accept')).toHaveLength(0);
});

test('usuário já logado aceita somente ao clicar em "Aceitar com esta conta"', async ({ page }) => {
  const chamadas: ChamadaConvite[] = [];
  await mockOwnerSession(page, {
    chamadas,
    inviteResponse: { status: 'aceito', mensagem: 'Convite aceito. Você já pode acessar a equipe.' },
  });
  await loginComoOwner(page);

  await page.goto('/login?modo=cadastrar&convite=token-e2e');
  await page.getByRole('button', { name: 'Aceitar com esta conta' }).click();

  await page.waitForURL('**/app', { timeout: 15_000 });
  expect(chamadas.filter((c) => c.action === 'accept')).toHaveLength(1);
});

test('convite inválido continua mostrando o erro do servidor no aceite explícito', async ({ page }) => {
  await mockOwnerSession(page, {
    inviteStatus: 400,
    inviteResponse: { error: 'Convite inválido, expirado ou já aceito.' },
  });
  await loginComoOwner(page);

  await page.goto('/login?modo=cadastrar&convite=token-invalido');
  await page.getByRole('button', { name: 'Aceitar com esta conta' }).click();

  await expect(page.getByRole('heading', { name: 'Não foi possível aceitar o convite' })).toBeVisible();
  await expect(page.getByText('Convite inválido, expirado ou já aceito.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Ir para o app' })).toBeVisible();
});
