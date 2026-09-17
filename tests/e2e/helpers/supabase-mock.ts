import type { Page } from '@playwright/test';

/**
 * Sessão Supabase fake + interceptação de rest/v1, auth/v1 e functions/v1.
 * Permite testar o shell autenticado sem banco: o estado vive no processo do
 * teste, e o PATCH em profiles persiste para GETs seguintes (reload, re-login).
 */
export type Papel = 'owner' | 'gestor' | 'tecnico' | 'leitor' | 'super_admin';

export interface OpcoesMock {
  papel?: Papel;
  /** Valor inicial de profiles.atalhos_mobile (null = usuário nunca personalizou). */
  atalhosMobile?: string[] | null;
  /** Simula falha ao gravar o perfil (testa preservação da configuração anterior). */
  falharAoSalvar?: boolean;
}

const EMPRESA = { id: 'emp-1', nome: 'Empresa E2E', slug: 'empresa-e2e', cnpj: null, email_principal: null, telefone: null, status: 'ativa', criado_por: null, criado_em: '2025-01-10T12:00:00Z' };
const CIDADES = [{ id: 'cid-1', empresa_id: 'emp-1', nome: 'Cidade E2E', uf: 'MG', ativa: true, criado_em: '2025-01-10T12:00:00Z', empresas: { id: 'emp-1', nome: EMPRESA.nome } }];
const SETORES = [{ id: 'set-1', empresa_id: 'emp-1', cidade_id: 'cid-1', nome: 'Setor E2E', responsavel: null, criado_em: '2025-01-11T12:00:00Z' }];

function jwtFake(sub: string, email: string) {
  const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub, aud: 'authenticated', role: 'authenticated', email, exp: 4102444800, iat: 1700000000 })}.fake`;
}

export async function prepararSupabaseMock(page: Page, opcoes: OpcoesMock = {}) {
  const papel = opcoes.papel ?? 'owner';
  const superAdmin = papel === 'super_admin';
  const perfil: Record<string, unknown> = {
    id: superAdmin ? 'user-sa' : 'user-1',
    empresa_id: superAdmin ? null : EMPRESA.id,
    nome: superAdmin ? 'Admin Plataforma' : 'Usuário E2E',
    email: superAdmin ? 'admin@e2e.test' : 'usuario@e2e.test',
    papel, telefone: null, email_verificado: true, cidade_id: 'cid-1', avatar_url: null, ativo: true,
    criado_em: '2025-01-10T12:00:00Z',
    atalhos_mobile: opcoes.atalhosMobile ?? null,
    empresas: superAdmin ? null : { id: EMPRESA.id, nome: EMPRESA.nome, slug: EMPRESA.slug, status: EMPRESA.status },
  };
  const estado = { perfil, gravacoes: [] as unknown[] };

  const user = { id: perfil.id, aud: 'authenticated', role: 'authenticated', email: perfil.email, email_confirmed_at: '2025-01-10T12:00:00Z', app_metadata: { provider: 'email' }, user_metadata: { nome: perfil.nome }, created_at: '2025-01-10T12:00:00Z', updated_at: '2025-01-10T12:00:00Z' };
  const session = { access_token: jwtFake(perfil.id as string, perfil.email as string), token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, refresh_token: 'refresh-fake', user };

  // Reinjeta a sessão a cada carregamento de documento: cobre reload e o "login" após um logout.
  await page.addInitScript(({ session: s }) => {
    localStorage.setItem('maintenex.auth', JSON.stringify(s));
    localStorage.setItem('maintenex.tema', 'escuro');
    localStorage.setItem('maintenex.cidade', 'cid-1');
  }, { session });

  await page.route('**/auth/v1/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/logout')) return route.fulfill({ status: 204, body: '' });
    if (url.includes('/user')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(user) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(session) });
  });
  await page.route('**/functions/v1/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));

  await page.route('**/rest/v1/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const tabela = url.pathname.split('/rest/v1/')[1]?.split('?')[0];
    // .single()/.maybeSingle() pedem um objeto (Accept vnd.pgrst.object+json); listas voltam como array.
    const singular = (req.headers()['accept'] ?? '').includes('vnd.pgrst.object');
    const json = (corpo: unknown, status = 200) => {
      const body = Array.isArray(corpo) && singular && status === 200 ? (corpo[0] ?? null) : corpo;
      return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    };

    if (tabela === 'profiles') {
      if (req.method() === 'PATCH') {
        if (url.searchParams.get('id') !== `eq.${estado.perfil.id}`) return json([]); // RLS: só a própria linha
        if (opcoes.falharAoSalvar) return json({ code: '42501', message: 'falha simulada', details: null, hint: null }, 403);
        const corpo = JSON.parse(req.postData() ?? '{}') as Record<string, unknown>;
        estado.gravacoes.push(corpo);
        estado.perfil = { ...estado.perfil, ...corpo };
        return json([estado.perfil]);
      }
      const filtroId = url.searchParams.get('id');
      if (filtroId) return json(filtroId === `eq.${estado.perfil.id}` ? [estado.perfil] : []);
      return json([estado.perfil]);
    }
    if (req.method() !== 'GET') return json([]);
    if (tabela === 'cidades') return json(CIDADES);
    if (tabela === 'setores') return json(SETORES);
    if (tabela === 'empresas') return json([EMPRESA]);
    if (tabela === 'dashboard_configuracoes') return json([{ empresa_id: EMPRESA.id, layout: null }]);
    return json([]);
  });

  return estado;
}

export async function abrirApp(page: Page, rota = '/app') {
  await page.goto(rota, { waitUntil: 'networkidle' });
  await page.waitForSelector('.content section');
}

export function rotulosBottomNav(page: Page) {
  return page.locator('.bottom-nav > a, .bottom-nav > button').evaluateAll((els) => els.map((el) => el.getAttribute('aria-label') ?? el.textContent?.trim() ?? ''));
}
