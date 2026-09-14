# Maintenex — Schema Supabase

Este diretório contém a estrutura de banco de dados e migrations do Maintenex.

## 📁 Estrutura

### `migrations/`
Migrations reproduzíveis e ordenadas do schema Supabase.

**Ordem de aplicação para novos ambientes:**
1. `0001_init.sql` — schema base completo (enums, tabelas, triggers, RLS)
2. `0002_seed.sql` — no-op reservado para compatibilidade histórica; não insere dados
3. `0006_verificacao_cadastro.sql` — adiciona `telefone` e `email_verificado` + trigger de sincronização com Auth
4. `0007_restringir_funcao_verificacao.sql` — revoga execução da função de sync
5. `0008_hardening_autorizacao.sql` — endurece `empresa_atual()`, `proteger_papel()` e revogações
6. `0009_detalhes_checklist.sql` — adiciona `checklists.tecnico_nome`
7. `0010_secoes_checklist.sql` — adiciona `checklist_itens.secao`
8. `0011_grants_api_autenticada.sql` — normaliza grants mínimos para `authenticated`; RLS continua isolando por empresa/papel
9. `0012_integridade_multi_tenant.sql` — adiciona preflight de integridade, FKs compostas com `empresa_id`, índices de suporte e remove `unaccent_simples(text)` da superfície RPC
10. `20260910230508_harden_rls_performance.sql` — elimina políticas permissivas duplicadas, corrige `auth.uid()` init plan, adiciona índices FK e fixa `search_path` do utilitário de slug
11. `20260910235534_dashboard_personalizacao.sql` — adiciona layout de dashboard por empresa, catálogo de 62 visuais no frontend e RLS administrativo
12. `20260911120000_team_invites.sql` — adiciona convites de equipe tokenizados, status de envio, mutações server-side e aceite seguro por token
13. `20260914010000_fix_rls_helper_row_security.sql` — reescreve as helpers `empresa_atual()`, `eh_super_admin()`, `pode_*()` com `set row_security = off` (fix de recursão de RLS que existia só em produção); deve ser a última a redefinir essas funções

**Aplicação automática via Supabase CLI (somente para ambientes autorizados):**
```bash
supabase login
supabase link --project-ref <PROJECT_REF>
supabase db push
```

Para desenvolvimento local isolado, use apenas `supabase db reset` dentro deste diretório e não vincule o projeto local a Supabase Cloud.

### `admin-scripts/`
Scripts administrativos manuais que **nunca devem ser executados por `db push` automático**.

Contém:
- `0003_promover_super_admin.sql` — promove usuário existente a `super_admin`
- `0004_criar_super_admin.sql` — cria conta `super_admin` do zero
- `0005_reparar_admin.sql` — repara/recria conta administrativa

**Importante:**
- Todos exigem alterar `email_admin` de `'ALTERE_PARA_EMAIL_ADMIN'` para email real
- Executar **somente no SQL Editor** após criar o ambiente
- Uso controlado para administração da plataforma

### `setup-completo.sql`
Snapshot consolidado do estado final do schema.

**Uso recomendado:**
- Bootstrap manual via SQL Editor do Supabase Dashboard
- Referência consolidada para revisão
- Recuperação controlada

**Não deve substituir migrations incrementais** no fluxo normal de desenvolvimento.

**Contém:**
- Schema completo equivalente a `0001` + `0006`–`0012` + hardening de performance/RLS das migrations `20260910230508_harden_rls_performance.sql` e `20260910235534_dashboard_personalizacao.sql`
- Trigger de sincronização `auth.users` → `profiles`
- RLS completo, hardenings, integridade multi-tenant por FKs compostas e configuração de dashboard por empresa
- Conferência final do schema criado

### `testes/`
Stubs e testes locais de RLS.

Não aplicar em ambientes reais, exceto `testes/security-check.sql`, que é somente leitura e pode ser executado localmente após `supabase db reset` para validar RLS e grants.

`testes/rls.sql` cria dados e contém grants amplos apenas para harness local isolado; não use esse arquivo em staging/produção.

---

## ⚠️ Seed de Demonstração (`seeds/demo.sql`)

**Natureza:** dados fictícios, **não** evolução de schema.

**Comportamento:**
- Seleciona a primeira empresa por `order by criado_em limit 1`
- No-op se `empresas` estiver vazio
- Parcialmente idempotente (usa `on conflict do nothing`)
- Usa datas relativas e UUIDs gerados

**Recomendação:**
- **Não executar automaticamente** durante `db push` em ambientes controlados
- Executar **manualmente** via SQL Editor apenas após criar a empresa de teste
- Considerar como dados de demonstração opcional, não requisito de schema

`migrations/0002_seed.sql` foi mantido como no-op reservado para compatibilidade com ambientes que já registraram a versão `0002`, evitando migration drift sem inserir dados demo automaticamente. Para staging/production, prefira seeds específicos e controlados separadamente.

---

## 🏗️ Criação de Novo Ambiente

### Opção A: Migrations Incrementais (Recomendado)

```bash
# 1. Criar projeto Supabase via Dashboard
# 2. Vincular localmente
cd frontend/src/supabase
supabase login
supabase link --project-ref <NEW_PROJECT_REF>

# 3. Aplicar migrations de schema (executa 0001, 0002 no-op, 0006-0012)
supabase db push

# 4. Criar primeira conta owner pelo app
# Acessar /login?modo=cadastrar e criar conta com nome da empresa

# 5. (Opcional) Executar seed manualmente se quiser dados demo
# SQL Editor: executar conteúdo de seeds/demo.sql

# 6. (Opcional) Super_admin somente se necessário
# SQL Editor: editar e executar admin-scripts/0003_promover_super_admin.sql
```

### Opção B: Setup Consolidado Manual

```bash
# 1. Criar projeto Supabase via Dashboard
# 2. SQL Editor do Dashboard
# 3. Copiar e colar todo o conteúdo de setup-completo.sql
# 4. Executar
# 5. Criar primeira conta owner pelo app
# 6. (Opcional) Executar seeds/demo.sql manualmente se quiser dados demo
```

---

## 🔒 Modelo Multi-Tenant

### Isolamento
- Tabelas operacionais carregam `empresa_id`
- RLS valida `row.empresa_id = empresa_atual()`
- `super_admin` tem bypass cross-tenant via `eh_super_admin()`

### Integridade referencial tenant-scoped

Regra arquitetural: toda FK entre duas tabelas tenant-scoped deve incluir `empresa_id`, salvo exceção documentada.

A migration `0012_integridade_multi_tenant.sql` reforça essa regra no banco:

- executa um preflight antes de alterar constraints; se encontrar inconsistência legada, falha com `RAISE EXCEPTION` e informa relação/quantidade, sem apagar ou corrigir dados automaticamente;
- cria constraints únicas compostas de suporte em tabelas pai como `cidades(id, empresa_id)`, `equipamentos(id, empresa_id)`, `checklists(id, empresa_id)`, `materiais(id, empresa_id)` e `profiles(id, empresa_id)`;
- cria `setores(id, cidade_id, empresa_id)` para permitir a regra forte de equipamento: quando `equipamentos.setor_id` existe, o setor precisa ser da mesma empresa e da mesma cidade do equipamento;
- substitui as FKs simples por FKs compostas mantendo os nomes das constraints antigas, preservando o `ON DELETE` existente e evitando relações paralelas ambíguas no PostgREST;
- adiciona índices nos lados filhos das FKs compostas, com índices parciais em referências opcionais;
- garante que `profiles.cidade_id` seja `NULL` quando `profiles.empresa_id` for `NULL`, preservando `super_admin` legítimo sem empresa.

Nesta etapa, `movimentacoes.equipamento_id` e `pendencias.equipamento_id` são validados por empresa. A regra adicional de mesma cidade entre movimentação/pendência e equipamento fica para migration futura se o produto exigir esse comportamento explicitamente.

### Papéis e Permissões

| Papel | Cadastros<br/>(cidades, setores, equipamentos, materiais) | Operação<br/>(checklists, estoque, movimentações, pendências) | Empresas | Profiles | Convites |
|-------|-------|-------|-------|-------|-------|
| `leitor` | read | read | — | self | — |
| `tecnico` | read | read + write | — | self | — |
| `gestor` | read + write | read + write | — | self | — |
| `owner` | read + write | read + write | own (select+update) | admin empresa | lê empresa; cria/reenvia/remove via Edge Function |
| `super_admin` | all cross-tenant | all cross-tenant | all | all | lê cross-tenant; cria/reenvia/remove via Edge Function |

### Grants SQL x RLS

PostgREST precisa de grants SQL para alcançar uma tabela, mas esses grants não substituem autorização por linha. No Maintenex:

- `authenticated` deve ter somente `SELECT`, `INSERT`, `UPDATE` e `DELETE` nas tabelas públicas da aplicação, exceto `convites`, que expõe apenas `SELECT` para o frontend.
- `authenticated` não deve ter `TRUNCATE`, `REFERENCES`, `TRIGGER` ou `MAINTAIN` nas tabelas da aplicação; esses privilégios não são usados pelo frontend/PostgREST atual para leitura e escrita de registros.
- `anon` não deve ter grants em tabelas ou sequences da aplicação.
- Toda tabela pública nova da aplicação precisa de RLS habilitada, policies definidas e grants mínimos antes de ser considerada pronta.
- Mutações de `convites` não são feitas pelo navegador: a Edge Function `team-invites` usa service role e funções administrativas `SECURITY DEFINER` para validar ator, empresa ativa, papel, e-mail, token e usuário existente.
- Grants SQL e policies RLS são camadas diferentes: grants permitem a tentativa de acesso; RLS decide quais linhas a sessão autenticada pode ver ou modificar.

A migration `0011_grants_api_autenticada.sql` também ajusta default privileges do papel `postgres` no schema `public`, porque o Supabase local pode herdar ACLs amplas para objetos criados por esse owner. Roles internas como `service_role` e `supabase_admin` não devem ser reduzidas sem evidência específica para evitar quebrar o funcionamento interno do Supabase.

### Triggers SECURITY DEFINER
- `handle_new_user()` — auto-cadastro de empresa ou aceite de convite tokenizado
- `aplicar_movimentacao()` — atualiza saldo de `estoque` após `movimentacoes`
- `proteger_papel()` — impede auto-escalação e protege campos sensíveis
- `proteger_convite()` — impede convite `super_admin` e cross-empresa
- `sincronizar_verificacao_usuario()` — sincroniza `auth.users` → `profiles`

### Hardening (0008)
- `empresa_atual()` bloqueia empresas `suspensa`/`cancelada`
- `proteger_papel()` estendido para proteger `ativo`, `email`, `telefone`, `email_verificado`, `criado_em`
- Revogações explícitas: triggers não são endpoints RPC

### Hardening (0012)
- `public.unaccent_simples(text)` é utilitário interno do cadastro e não deve ser exposta como RPC.
- `EXECUTE` é revogado de `PUBLIC`, `anon` e `authenticated`.
- `handle_new_user()` continua podendo usar `unaccent_simples(text)` no cadastro local porque a trigger function é `SECURITY DEFINER` e roda com `search_path` controlado.
- `unaccent_simples(text)` não deve ser convertida para `SECURITY DEFINER`.

### Convites de equipe server-side

A migration `20260911120000_team_invites.sql` troca o aceite por e-mail simples por um fluxo com link individual:

- a Edge Function `team-invites` gera um token aleatório e salva em `convites.token_hash` apenas `sha256(token)`;
- `handle_new_user()` só aceita convite quando `raw_user_meta_data.convite_token` corresponde ao hash, ao e-mail e a um convite pendente não expirado;
- a função `admin_aceitar_convite_equipe()` permite aceitar o convite para usuário autenticado já existente sem empresa;
- e-mails já membros da mesma empresa retornam status informativo, e e-mails vinculados a outra empresa são bloqueados;
- `status_envio`, `tentativas_envio`, `enviado_em`, `reenviado_em` e `ultimo_erro_envio` registram envio, dry-run, reenvio e falhas.
- `admin_preparar_convite_equipe()` bloqueia a linha do convite (`for update`) e recusa reenvio em menos de 1 minuto após um envio bem-sucedido, evitando disparos concorrentes e abuso de e-mail.

Variáveis da Edge Function são server-side: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `INVITES_FROM`, `INVITES_DRY_RUN` e `SITE_URL`/`APP_SITE_URL`. `INVITES_DRY_RUN=true` ativa explicitamente o modo teste, não envia e-mail real e retorna o link seguro para validação local. Fora desse modo explícito, ausência de `RESEND_API_KEY` ou `INVITES_FROM` é erro de configuração de envio.

### Regras para migrations futuras
- Toda nova tabela tenant-scoped deve carregar `empresa_id`, habilitar RLS e receber policies/grants mínimos antes de uso pela API.
- Toda FK nova entre tabelas tenant-scoped deve incluir `empresa_id`; exceções precisam ser justificadas no SQL e neste README.
- Se uma referência opcional usar `ON DELETE SET NULL` em FK composta, use column-list quando necessário para não anular `empresa_id` do registro filho.
- Antes de adicionar constraints sobre dados existentes, crie preflight explícito com relação/quantidade e falha transacional; não faça limpeza automática em migration de schema.
- Evite FKs paralelas para o mesmo relacionamento no PostgREST: substitua a FK antiga preservando o nome quando possível.
- Crie índices de suporte no lado filho das FKs compostas e evite duplicar índices já cobertos.

---

## 🧪 Validação de Ambiente

Após aplicar schema, validar com:

```sql
-- Validar tabelas
SELECT count(*) FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN (
  'empresas','profiles','convites','cidades','setores',
  'equipamentos','checklists','checklist_itens','materiais',
  'estoque','movimentacoes','pendencias','dashboard_configuracoes'
);
-- Esperado: 13

-- Validar trigger crítico de sincronização
SELECT exists (
  SELECT 1 FROM pg_trigger 
  WHERE tgname = 'z_sync_auth_user_verification'
);
-- Esperado: true

-- Validar função crítica
SELECT to_regprocedure('public.sincronizar_verificacao_usuario()') IS NOT NULL;
-- Esperado: true

-- Validar políticas RLS
SELECT count(*) FROM pg_policies WHERE schemaname = 'public';
-- Esperado: > 0

-- Validar grants mínimos para authenticated nas tabelas da aplicação
SELECT table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee = 'authenticated'
  AND table_name IN (
    'empresas','profiles','convites','cidades','setores',
    'equipamentos','checklists','checklist_itens','materiais',
    'estoque','movimentacoes','pendencias','dashboard_configuracoes'
  )
ORDER BY table_name, privilege_type;
-- Esperado por tabela: grants do domínio; convites usa apenas SELECT no frontend; dashboard_configuracoes usa INSERT, SELECT, UPDATE
-- Não esperado: TRUNCATE, REFERENCES, TRIGGER, MAINTAIN

-- Validar que anon não tem grants nas tabelas da aplicação
SELECT table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee = 'anon'
  AND table_name IN (
    'empresas','profiles','convites','cidades','setores',
    'equipamentos','checklists','checklist_itens','materiais',
    'estoque','movimentacoes','pendencias','dashboard_configuracoes'
  );
-- Esperado: 0 linhas

-- Validação local consolidada, sem alterar schema
\i frontend/src/supabase/testes/security-check.sql

-- Validar colunas adicionadas por migrations
SELECT 
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='telefone'),
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='email_verificado'),
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='checklists' AND column_name='tecnico_nome'),
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='checklist_itens' AND column_name='secao');
-- Esperado: t, t, t, t
```

---

## 📋 Checklist de Staging Seguro

Antes de considerar staging pronto:

- [ ] Migrations aplicadas sem scripts administrativos no fluxo automático
- [ ] Trigger `z_sync_auth_user_verification` confirmado
- [ ] Função `sincronizar_verificacao_usuario()` confirmada
- [ ] 13 tabelas públicas validadas
- [ ] RLS ativo e policies presentes em todas as tabelas públicas da aplicação
- [ ] Grants SQL mínimos para `authenticated` aplicados (`SELECT`, `INSERT`, `UPDATE`, `DELETE`)
- [ ] Sem `TRUNCATE`, `REFERENCES`, `TRIGGER` ou `MAINTAIN` para `authenticated` nas tabelas da aplicação
- [ ] `anon` sem grants nas tabelas/sequences da aplicação
- [ ] `testes/security-check.sql` executado localmente após migrations
- [ ] Conta owner de teste criada e confirmada
- [ ] `profiles.telefone` e `profiles.email_verificado` populados
- [ ] Empresa de teste com status `ativa`
- [ ] URL staging **não é produção**
- [ ] Variáveis de ambiente staging configuradas (Vercel + GitHub Secrets)
- [ ] Sem credenciais hardcoded

---

## 🔍 Fonte Oficial de Schema

**`migrations/`** é a fonte de verdade oficial para:
- Criação de novos ambientes
- Evolução incremental de ambientes existentes
- Histórico auditável de alterações
- Reprodutibilidade entre ambientes

**`setup-completo.sql`** é útil para:
- Bootstrap manual rápido
- Revisão consolidada
- Casos de recuperação controlada

Mas não substitui migrations no fluxo normal.

---

## 🧭 Reconciliação com a produção (auditoria de 2026-09-14)

O history remoto de produção não usa os números do repositório: registra `0001`, `0002`, os admin-scripts `0003–0005`, `20260820145725 verificacao_cadastro`, `20260820145807 restringir_funcao_verificacao`, `20260820202809 detalhes_checklist`, `20260820204813 secoes_checklist`, `20260910232221 fix_rls_helper_functions_recursion` (só em produção; replicado aqui por `20260914010000`) e `20260911003150 dashboard_personalizacao`. O schema real equivale a `0001`+`0002`+`0006`–`0010`+`20260910235534`+fix de recursão; faltam `0011`, `0012`, `20260910230508` e `20260911120000`.

Plano ensaiado localmente (banco descartável `prodsim`): `migration repair --status applied 0006 0007 0008 0009 0010 20260910235534`, `migration repair --status reverted` das nove versões que só existem no remoto (a CLI 2.115.0 recusa `db push` enquanto houver versão remota sem arquivo local), `db push --dry-run --include-all` e `db push --include-all`. Antes disso rode `testes/preflight-producao.sql` (somente SELECT): o preflight da `0012` exige `profiles.cidade_id` nulo para perfis sem empresa (`super_admin`) e responsáveis de pendências na mesma empresa.

Produção também possui uma role Postgres `admin` (LOGIN, privilégios amplos) que não tem origem no repositório; não é usada pelas migrations nem pela aplicação. Origem a confirmar no Dashboard antes de qualquer decisão.

## ⚠️ Drift histórico: `frontend/supabase/`

`frontend/src/supabase/` é o único diretório Supabase canônico (config, migrations, seeds, testes e `functions/`). O diretório `frontend/supabase/` é um espelho antigo, congelado nas migrations `0001`–`0012`, sem `seeds/` e sem as migrations `20260910230508`, `20260910235534` e `20260911120000`; ele não deve ser usado como workdir da CLI nem receber novas migrations. Comandos locais devem usar `--workdir frontend/src` (ou rodar a partir de `frontend/src`). A remoção do espelho fica para uma limpeza separada.

### `functions/`

Edge Functions do projeto (`functions/team-invites/index.ts`). O `tsconfig.json` do frontend exclui `src/supabase/functions` porque esse código roda no runtime Deno. Localmente: `supabase functions serve team-invites --workdir frontend/src --env-file <arquivo com INVITES_DRY_RUN=true>`.

## 🚧 Melhorias Futuras

Identificadas mas não implementadas ainda:

- **Mesma cidade em operações com equipamento:** avaliar regra explícita para validar que `movimentacoes.equipamento_id` e `pendencias.equipamento_id`, quando preenchidos, apontem para equipamento da mesma cidade operacional do registro. A migration `0012` já garante isolamento por `empresa_id`; a restrição por cidade depende de decisão de produto.
- **Seeds controlados por ambiente:** criar seeds específicos para staging sem dados relativos ou dependência da primeira empresa cadastrada
