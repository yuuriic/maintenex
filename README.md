# Maintenex

Sistema de gestão de manutenção: checklists preventivos, estoque de peças e
pendências com SLA. Reimplementação independente do sistema criado no Base44.

## Arquitetura

- `frontend`: React + Vite + TypeScript. Fala direto com o Supabase (auth + banco).
- `frontend/src/supabase`: migrations de schema, scripts administrativos manuais, testes locais e seeds opcionais.
- `backend`: Spring Boot legado, **mantido parado** no repositório. O produto não depende dele.
- `docker-compose.yml`: PostgreSQL local, usado apenas pelo backend legado.

### Rotas

| Rota | Acesso | Conteúdo |
| --- | --- | --- |
| `/` | público | landing page (SEO/GEO) |
| `/login` | público | entrar, criar conta, recuperar senha |
| `/app` … `/app/configuracoes` | autenticado | painel |
| `/app/empresas` | super_admin | administração da plataforma |

## Níveis de acesso

| Papel | Alcance |
| --- | --- |
| `super_admin` | Plataforma. Cria empresas e enxerga todas elas. Sem `empresa_id`. |
| `owner` | Responsável pela empresa. Convida usuários, define papéis, edita a empresa. |
| `gestor` | Cadastros (cidades, setores, equipamentos, materiais) + toda a operação. |
| `tecnico` | Operação: checklists, movimentações de estoque e pendências. |
| `leitor` | Somente leitura. |

Uma empresa entra de dois jeitos:

1. **Auto-cadastro** — no `/login?modo=cadastrar` o usuário informa o nome da empresa.
   O trigger cria a empresa e o primeiro usuário vira `owner`.
2. **Cadastro pela plataforma** — o `super_admin` cria a empresa em `/app/empresas`
   e registra um convite com papel `owner` para o e-mail do responsável.

Convites: o responsável registra o e-mail em **Configurações → Equipe**. Quando a
pessoa cria a conta com aquele e-mail, o trigger a vincula à empresa com o papel do convite.

## Configurar o Supabase

### 1. Aplicar o schema

No painel do Supabase → **SQL Editor** → cole e execute, nesta ordem:

1. `frontend/src/supabase/migrations/0001_init.sql` — tabelas, triggers e RLS
2. `frontend/src/supabase/migrations/0002_seed.sql` — no-op de compatibilidade histórica
3. `frontend/src/supabase/migrations/0006_verificacao_cadastro.sql` até `0010_secoes_checklist.sql` — evoluções de schema

Dados de demonstração opcionais ficam em `frontend/src/supabase/seeds/demo.sql` e devem ser executados manualmente somente quando necessário.

Ou, com a CLI autenticada:

```bash
supabase login
supabase link --project-ref SEU_PROJECT_REF
supabase db push
```

### 2. Criar o primeiro usuário

Acesse `/login?modo=cadastrar`, informe nome, **nome da empresa**, e-mail e senha.
Esse usuário vira o `owner` da empresa criada.

### 3. Promover a administração da plataforma

Edite `frontend/src/supabase/admin-scripts/0003_promover_super_admin.sql` com o seu e-mail e execute
no SQL Editor. Esse usuário passa a ver a aba **Empresas**.

## Rodar local

```bash
cd frontend
cp .env.example .env   # preencha as duas variáveis
npm install
npm run dev
```

Disponível em `http://localhost:5173`.

## Variáveis de ambiente

O frontend é Vite: **só variáveis com prefixo `VITE_` chegam ao navegador**
(`NEXT_PUBLIC_*` é ignorado). São lidas em tempo de build — ao alterá-las na Vercel,
refaça o deploy.

| Variável | Obrigatória | Descrição |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | sim | URL do projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | sim | chave `anon public` (ou `sb_publishable_…`) |
| `VITE_SITE_URL` | não | domínio público e destino dos links de recuperação |
| `VITE_API_URL` | não | URL da API Spring; sem ela, o frontend usa Supabase Auth diretamente |
| `VITE_EMAIL_OTP_LENGTH` | não | Tamanho do OTP configurado no Supabase; padrão `8` |

Nunca publique a `service_role` no frontend.

### E-mail transacional: Resend + Supabase

1. No Resend, valide um domínio de envio e crie uma API key.
2. Em **Supabase → Authentication → Email → SMTP Settings**, habilite SMTP e use:
   - host `smtp.resend.com`, porta `465`, usuário `resend`;
   - senha igual à API key do Resend;
   - remetente pertencente ao domínio validado (por exemplo `no-reply@auth.seudominio.com`).
3. Mantenha **Confirm email** habilitado. No template **Confirm signup**, inclua o código
   `{{ .Token }}` no corpo; o cadastro aceita o OTP configurado com seis a oito dígitos.
4. Em **URL Configuration**, defina **Site URL** como o domínio de produção e adicione
   `https://SEU_DOMINIO/redefinir-senha` e `http://localhost:5173/redefinir-senha` nas Redirect URLs.
5. Aplique `frontend/src/supabase/migrations/0006_verificacao_cadastro.sql` para salvar
   telefone e status de verificação no perfil.

O mesmo SMTP envia confirmação e recuperação de senha. Para diagnosticar entrega, confira
**Authentication → Logs** no Supabase e **Emails → Logs** no Resend; verifique também bounce,
suppression e os registros SPF/DKIM/DMARC do domínio.

Se a API Spring for usada, configure no backend `SUPABASE_URL` e
`SUPABASE_PUBLISHABLE_KEY`. Os endpoints públicos são `POST /api/auth/signup`,
`/verify`, `/resend` (máximo de 3 reenvios por hora) e `/recover`.

## Deploy na Vercel

- **Root Directory**: `frontend`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- Variáveis: as `VITE_*` acima, nos três ambientes.
- SPA: adicione um rewrite de `/(.*)` para `/index.html` para as rotas do React Router
  funcionarem em acesso direto.

## Segurança

- RLS ativa em todas as tabelas; as políticas usam funções `security definer`
  (`empresa_atual()`, `eh_super_admin()`, `pode_gerir_cadastro()`, `pode_operar()`).
- Isolamento por `empresa_id`: um usuário só enxerga a própria empresa; `super_admin` vê tudo.
- Usuário desativado (`ativo = false`) perde leitura e escrita — os helpers retornam nulo/false.
- `anon` não tem acesso a nenhuma tabela (`revoke all … from anon`).
- Trigger `proteger_papel()` impede auto-escalação: ninguém altera o próprio papel ou a
  própria empresa, e só `super_admin` concede `super_admin`.
- Trigger `proteger_convite()` impede convite com papel `super_admin` e convite para outra empresa.

## Estado atual

- [x] Landing pública com SEO (meta tags, Open Graph, JSON-LD, robots, sitemap)
- [x] Autenticação Supabase (entrar, cadastrar, recuperar senha)
- [x] Dashboard, Checklist, Equipamentos, Estoque, Pendências, Relatórios, Configurações
- [x] Multiempresa com três níveis de acesso e convites
- [x] Tema claro/escuro, busca rápida (⌘K), notificações, exportação CSV
- [ ] Envio de e-mail do convite (hoje o convite é registrado; a pessoa se cadastra pelo `/login`)
